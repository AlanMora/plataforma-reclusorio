import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ObjectType } from 'typeorm';
import {
  Autoridad,
  Centro,
  Delito,
  DestinoTraslado,
  JuezJuzgado,
  Juzgado,
  TipoAudiencia,
  TipoIncidencia,
} from '../entities/catalogos-administrables.entities';
import {
  EstatusTraslado,
  FormaIngresoAudiencia,
  ModalidadAudiencia,
  MotivoMovimiento,
  ProximaAudiencia,
  ResolucionAudiencia,
  TipoIngresoEgreso,
  TipoMovimiento,
  TipoTraslado,
} from '../entities/catalogos-fijos.entities';
import {
  SEED_AUTORIDAD,
  SEED_CATALOGOS_FIJOS,
  SEED_CENTROS,
  SEED_DELITOS,
  SEED_DESTINO_TRASLADO,
  SEED_JUEZ_JUZGADOS,
  SEED_JUZGADOS,
  SEED_TIPO_AUDIENCIA,
  SEED_TIPO_INCIDENCIA,
} from './catalogos.seed';

const FIJOS: Array<{ tabla: keyof typeof SEED_CATALOGOS_FIJOS; entidad: ObjectType<object> }> = [
  { tabla: 'tipo_ingreso_egreso', entidad: TipoIngresoEgreso },
  { tabla: 'tipo_movimientos', entidad: TipoMovimiento },
  { tabla: 'motivo_movimiento', entidad: MotivoMovimiento },
  { tabla: 'forma_ingreso_audiencia', entidad: FormaIngresoAudiencia },
  { tabla: 'resolucion_audiencia', entidad: ResolucionAudiencia },
  { tabla: 'modalidad_audiencia', entidad: ModalidadAudiencia },
  { tabla: 'proxima_audiencia', entidad: ProximaAudiencia },
  { tabla: 'tipo_traslado', entidad: TipoTraslado },
  { tabla: 'estatus_traslado', entidad: EstatusTraslado },
];

const ADMINISTRABLES: Array<{ entidad: ObjectType<object>; valores: string[] }> = [
  { entidad: Delito, valores: SEED_DELITOS },
  { entidad: Centro, valores: SEED_CENTROS },
  { entidad: Juzgado, valores: SEED_JUZGADOS },
  { entidad: JuezJuzgado, valores: SEED_JUEZ_JUZGADOS },
  { entidad: DestinoTraslado, valores: SEED_DESTINO_TRASLADO },
  { entidad: TipoAudiencia, valores: SEED_TIPO_AUDIENCIA },
  { entidad: TipoIncidencia, valores: SEED_TIPO_INCIDENCIA },
  { entidad: Autoridad, valores: SEED_AUTORIDAD },
];

/**
 * Siembra IDEMPOTENTE de catálogos (RF-CAT-007): inserta únicamente los
 * valores que aún no existen (comparación normalizada por nombre), por lo
 * que puede ejecutarse en cada arranque sin duplicar.
 * Se desactiva con SEED_CATALOGS=false (p. ej. en producción, donde la
 * siembra se hace una sola vez en el despliegue).
 */
@Injectable()
export class CatalogSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeederService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('SEED_CATALOGS', 'true') !== 'true') return;
    await this.seed();
  }

  async seed(): Promise<void> {
    let insertados = 0;

    for (const { entidad, valores } of ADMINISTRABLES) {
      insertados += await this.sembrar(entidad, valores, false);
    }
    for (const { entidad, tabla } of FIJOS) {
      insertados += await this.sembrar(entidad, SEED_CATALOGOS_FIJOS[tabla], true);
    }

    if (insertados > 0) {
      this.logger.log(`Catálogos sembrados: ${insertados} valores nuevos`);
    }
  }

  /** Inserta los valores faltantes; con `conOrden` asigna la posición (catálogos fijos). */
  private async sembrar(entidad: ObjectType<object>, valores: string[], conOrden: boolean): Promise<number> {
    const repo = this.dataSource.getRepository(entidad);
    const existentes = new Set(
      ((await repo.find()) as Array<{ nombre: string }>).map((r) => this.normalizar(r.nombre)),
    );
    let count = 0;
    for (let i = 0; i < valores.length; i++) {
      const nombre = valores[i].trim();
      if (existentes.has(this.normalizar(nombre))) continue;
      const fila: Record<string, unknown> = { nombre, activo: true };
      if (conOrden) fila['orden'] = i + 1;
      await repo.save(repo.create(fila));
      count++;
    }
    return count;
  }

  /** Normalización para dedup: trim + minúsculas + sin acentos (RF-CAT-006). */
  private normalizar(nombre: string): string {
    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
