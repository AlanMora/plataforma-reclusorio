import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Catálogos ADMINISTRABLES (Modelo de Datos §5). Estructura común:
 * PK UUID con nombre propio, nombre obligatorio, descripción opcional,
 * activo, fechaRegistro y fechaActualizacion.
 *
 * Reglas (RF-CAT-*): los nombres se guardan sin espacios extremos; los
 * valores usados se desactivan, nunca se eliminan físicamente; los
 * duplicados se comparan ignorando mayúsculas y acentos (índice único
 * funcional en la migración).
 */
abstract class CatalogoAdministrableBase {
  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion?: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaRegistro!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  fechaActualizacion!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizarNombre(): void {
    if (this.nombre) this.nombre = this.nombre.trim();
  }
}

@Entity('delitos')
export class Delito extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idDelito!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idDelito) this.idDelito = uuidv7();
  }
}

@Entity('centros')
export class Centro extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idCentro!: string;

  // Ubicación geográfica del centro penitenciario para el módulo de mapa
  // (decisión del equipo 2026-08-11, registrada como P9 en el PLAN).
  @Column({ type: 'double precision', nullable: true })
  latitud?: number;

  @Column({ type: 'double precision', nullable: true })
  longitud?: number;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idCentro) this.idCentro = uuidv7();
  }
}

@Entity('juzgados')
export class Juzgado extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idJuzgado!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idJuzgado) this.idJuzgado = uuidv7();
  }
}

@Entity('juez_juzgados')
export class JuezJuzgado extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idJuezJuzgado!: string;

  // El modelo define nombre VARCHAR(150) para este catálogo.
  @Column({ type: 'varchar', length: 150 })
  override nombre!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idJuezJuzgado) this.idJuezJuzgado = uuidv7();
  }
}

@Entity('destino_traslado')
export class DestinoTraslado extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idDestinoTraslado!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idDestinoTraslado) this.idDestinoTraslado = uuidv7();
  }
}

@Entity('tipo_audiencia')
export class TipoAudiencia extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idTipoAudiencia!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTipoAudiencia) this.idTipoAudiencia = uuidv7();
  }
}

@Entity('tipo_incidencia')
export class TipoIncidencia extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idTipoIncidencia!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTipoIncidencia) this.idTipoIncidencia = uuidv7();
  }
}

@Entity('autoridad')
export class Autoridad extends CatalogoAdministrableBase {
  @PrimaryColumn('uuid')
  idAutoridad!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idAutoridad) this.idAutoridad = uuidv7();
  }
}

export const CATALOGOS_ADMINISTRABLES = [
  Delito,
  Centro,
  Juzgado,
  JuezJuzgado,
  DestinoTraslado,
  TipoAudiencia,
  TipoIncidencia,
  Autoridad,
];
