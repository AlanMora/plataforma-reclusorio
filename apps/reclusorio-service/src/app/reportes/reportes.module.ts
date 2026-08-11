import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { RequirePermissions } from '@icms/auth';

export const MODULOS_REPORTE = [
  'ingresos-egresos',
  'movimientos',
  'audiencias',
  'traslados',
  'incidencias',
] as const;
export type ModuloReporte = (typeof MODULOS_REPORTE)[number];

class ReporteQuery {
  /** Inicio del periodo (inclusive), ISO-8601. */
  @IsDateString() desde!: string;
  /** Fin del periodo (exclusivo), ISO-8601 — "Hoy" = 00:00 de hoy a 00:00 de mañana. */
  @IsDateString() hasta!: string;
  /** Omitir para consolidar todos los módulos. */
  @IsOptional() @IsIn(MODULOS_REPORTE as unknown as string[]) modulo?: ModuloReporte;
}

export interface FilaReporte {
  modulo: ModuloReporte;
  id: string;
  fecha: Date;
  estadoRevision: string;
  persona: string | null;
  idPersona: string | null;
  /** Etiquetas legibles ya resueltas (catálogos por nombre). */
  detalle: Record<string, string | null>;
}

const NOMBRE_PERSONA = `TRIM(CONCAT_WS(' ', p."primerNombre", p."apellidoPaterno", p."apellidoMaterno"))`;

/**
 * Reporte consolidado de actividades (requerimiento del equipo 11/08/2026):
 * todas las actividades registradas en un periodo, con su estado de
 * validación (P10) y los catálogos resueltos a nombre para que el archivo
 * exportado sea una representación fiel y legible de la base de datos.
 */
@Injectable()
export class ReportesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async actividades(query: ReporteQuery): Promise<FilaReporte[]> {
    const params = [query.desde, query.hasta];
    const filas: FilaReporte[] = [];
    const incluir = (m: ModuloReporte) => !query.modulo || query.modulo === m;

    if (incluir('ingresos-egresos')) {
      const rows = await this.dataSource.query(
        `SELECT r."idIngresoEgreso" AS id, r.fecha, r."estadoRevision",
                r."idPersona", ${NOMBRE_PERSONA} AS persona,
                t.nombre AS tipo, c.nombre AS centro, d.nombre AS delito,
                r.ubicacion, r.autoridad
         FROM ingreso_egreso r
         JOIN personas p ON p."idPersona" = r."idPersona"
         LEFT JOIN tipo_ingreso_egreso t ON t."idTipoIngresoEgreso" = r."idTipoIngresoEgreso"
         LEFT JOIN centros c ON c."idCentro" = r."idCentroPenitenciario"
         LEFT JOIN delitos d ON d."idDelito" = r."idDelito"
         WHERE r.fecha >= $1 AND r.fecha < $2
         ORDER BY r.fecha`,
        params,
      );
      for (const f of rows) {
        filas.push(this.fila('ingresos-egresos', f, {
          tipo: f.tipo, centro: f.centro, delito: f.delito,
          ubicacion: f.ubicacion, autoridad: f.autoridad,
        }));
      }
    }

    if (incluir('movimientos')) {
      const rows = await this.dataSource.query(
        `SELECT r."idMovimiento" AS id, r.fecha, r."estadoRevision",
                r."idPersona", ${NOMBRE_PERSONA} AS persona,
                t.nombre AS tipo, m.nombre AS motivo,
                o.nombre AS "centroOrigen", d.nombre AS "centroDestino", r.ubicacion
         FROM movimientos r
         JOIN personas p ON p."idPersona" = r."idPersona"
         LEFT JOIN tipo_movimientos t ON t."idTipoMovimiento" = r."idTipoMovimiento"
         LEFT JOIN motivo_movimiento m ON m."idMotivoMovimiento" = r."idMotivoMovimiento"
         LEFT JOIN centros o ON o."idCentro" = r."idCentroOrigen"
         LEFT JOIN centros d ON d."idCentro" = r."idCentroDestino"
         WHERE r.fecha >= $1 AND r.fecha < $2
         ORDER BY r.fecha`,
        params,
      );
      for (const f of rows) {
        filas.push(this.fila('movimientos', f, {
          tipo: f.tipo, motivo: f.motivo,
          centroOrigen: f.centroOrigen, centroDestino: f.centroDestino, ubicacion: f.ubicacion,
        }));
      }
    }

    if (incluir('audiencias')) {
      const rows = await this.dataSource.query(
        `SELECT r."idAudiencia" AS id, r.fecha, r."estadoRevision",
                r."idPersona", ${NOMBRE_PERSONA} AS persona,
                ta.nombre AS tipo, j.nombre AS juzgado, jj.nombre AS juez,
                mo.nombre AS modalidad, re.nombre AS resolucion, pr.nombre AS "proximaAudiencia",
                r.ca, r.ci, r."nombreJuez", r.observaciones, r."fechaSiguienteAudiencia"
         FROM audiencias r
         JOIN personas p ON p."idPersona" = r."idPersona"
         LEFT JOIN tipo_audiencia ta ON ta."idTipoAudiencia" = r."idTipoAudiencia"
         LEFT JOIN juzgados j ON j."idJuzgado" = r."idJuzgado"
         LEFT JOIN juez_juzgados jj ON jj."idJuezJuzgado" = r."idJuezJuzgado"
         LEFT JOIN modalidad_audiencia mo ON mo."idModalidadAudiencia" = r."idModalidadAudiencia"
         LEFT JOIN resolucion_audiencia re ON re."idResolucionAudiencia" = r."idResolucionAudiencia"
         LEFT JOIN proxima_audiencia pr ON pr."idProximaAudiencia" = r."idProximaAudiencia"
         WHERE r.fecha >= $1 AND r.fecha < $2
         ORDER BY r.fecha`,
        params,
      );
      for (const f of rows) {
        filas.push(this.fila('audiencias', f, {
          tipo: f.tipo, juzgado: f.juzgado, juez: f.juez ?? f.nombreJuez,
          modalidad: f.modalidad, resolucion: f.resolucion,
          proximaAudiencia: f.proximaAudiencia,
          fechaSiguienteAudiencia: f.fechaSiguienteAudiencia
            ? new Date(f.fechaSiguienteAudiencia).toISOString()
            : null,
          ca: f.ca, ci: f.ci, observaciones: f.observaciones,
        }));
      }
    }

    if (incluir('traslados')) {
      const rows = await this.dataSource.query(
        `SELECT r."idTraslado" AS id, r.fecha, r."estadoRevision",
                r."idPersona", ${NOMBRE_PERSONA} AS persona,
                t.nombre AS tipo, d.nombre AS destino, e.nombre AS estatus,
                r.descripcion, r.unidades, r.observaciones
         FROM traslados r
         JOIN personas p ON p."idPersona" = r."idPersona"
         LEFT JOIN tipo_traslado t ON t."idTipoTraslado" = r."idTipoTraslado"
         LEFT JOIN destino_traslado d ON d."idDestinoTraslado" = r."idDestinoTraslado"
         LEFT JOIN estatus_traslado e ON e."idEstatusTraslado" = r."idEstatusTraslado"
         WHERE r.fecha >= $1 AND r.fecha < $2
         ORDER BY r.fecha`,
        params,
      );
      for (const f of rows) {
        filas.push(this.fila('traslados', f, {
          tipo: f.tipo, destino: f.destino, estatus: f.estatus,
          descripcion: f.descripcion, unidades: f.unidades, observaciones: f.observaciones,
        }));
      }
    }

    if (incluir('incidencias')) {
      const rows = await this.dataSource.query(
        `SELECT r."idIncidencia" AS id, r.fecha, r."estadoRevision",
                NULL AS "idPersona", NULL AS persona,
                t.nombre AS tipo, c.nombre AS centro,
                r.descripcion, r.iph, r."primerRespondiente", r.narrativa
         FROM incidencias r
         LEFT JOIN tipo_incidencia t ON t."idTipoIncidencia" = r."idTipoIncidencia"
         LEFT JOIN centros c ON c."idCentro" = r."idCentroPenitenciario"
         WHERE r.fecha >= $1 AND r.fecha < $2
         ORDER BY r.fecha`,
        params,
      );
      for (const f of rows) {
        filas.push(this.fila('incidencias', f, {
          tipo: f.tipo, centro: f.centro, descripcion: f.descripcion,
          iph: f.iph, primerRespondiente: f.primerRespondiente, narrativa: f.narrativa,
        }));
      }
    }

    filas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return filas;
  }

  private fila(
    modulo: ModuloReporte,
    f: { id: string; fecha: Date; estadoRevision: string; idPersona: string | null; persona: string | null },
    detalle: Record<string, string | null>,
  ): FilaReporte {
    return {
      modulo,
      id: f.id,
      fecha: f.fecha,
      estadoRevision: f.estadoRevision,
      idPersona: f.idPersona,
      persona: f.persona || null,
      detalle,
    };
  }
}

@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('actividades')
  @RequirePermissions('personas:consultar')
  @ApiOperation({
    summary:
      'Reporte consolidado de actividades por periodo [desde, hasta) con estado de validación (P10)',
  })
  actividades(@Query() query: ReporteQuery) {
    return this.service.actividades(query);
  }
}

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
