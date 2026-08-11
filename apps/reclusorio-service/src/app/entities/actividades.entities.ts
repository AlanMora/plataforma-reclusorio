import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Tabla ingreso_egreso (§3.5): ingresos y libertades asociados a una persona.
 * Los campos de catálogo guardan UUID, nunca el texto (RF-GEN-002).
 */
@Entity('ingreso_egreso')
export class IngresoEgreso {
  @PrimaryColumn('uuid')
  idIngresoEgreso!: string;

  @Index()
  @Column({ type: 'uuid' })
  idPersona!: string;

  @Column({ type: 'uuid' })
  idTipoIngresoEgreso!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  @Column({ type: 'uuid' })
  idCentroPenitenciario!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ubicacion?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  autoridad?: string;

  @Column({ type: 'uuid', nullable: true })
  idDelito?: string;


  /**
   * Validación inicial Confirmar/Descartar (decisión del equipo 2026-08-11,
   * P10 del PLAN): PENDIENTE al crear; una vez CONFIRMADO o DESCARTADO el
   * registro no admite más cambios.
   */
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estadoRevision!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idIngresoEgreso) this.idIngresoEgreso = uuidv7();
  }
}

/** Tabla movimientos (§3.6): reubicaciones o traslados internos de una persona. */
@Entity('movimientos')
export class Movimiento {
  @PrimaryColumn('uuid')
  idMovimiento!: string;

  @Index()
  @Column({ type: 'uuid' })
  idPersona!: string;

  @Column({ type: 'uuid' })
  idTipoMovimiento!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  @Column({ type: 'uuid' })
  idCentroOrigen!: string;

  @Column({ type: 'uuid' })
  idCentroDestino!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ubicacion?: string;

  @Column({ type: 'uuid' })
  idMotivoMovimiento!: string;


  /**
   * Validación inicial Confirmar/Descartar (decisión del equipo 2026-08-11,
   * P10 del PLAN): PENDIENTE al crear; una vez CONFIRMADO o DESCARTADO el
   * registro no admite más cambios.
   */
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estadoRevision!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idMovimiento) this.idMovimiento = uuidv7();
  }
}

/**
 * Tabla audiencias (§3.7). nombreJuez se conserva como texto para referencia
 * histórica además de la FK idJuezJuzgado (RF-AUD-002).
 * fechaSiguienteAudiencia debe ser coherente con proxima_audiencia (§8):
 * si el catálogo dice NO, la fecha permanece vacía (RF-AUD-004).
 */
@Entity('audiencias')
export class Audiencia {
  @PrimaryColumn('uuid')
  idAudiencia!: string;

  @Index()
  @Column({ type: 'uuid' })
  idPersona!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  // Número de causa.
  @Column({ type: 'varchar', length: 100, nullable: true })
  ca?: string;

  // Número de carpeta de investigación.
  @Column({ type: 'varchar', length: 100, nullable: true })
  ci?: string;

  @Column({ type: 'uuid' })
  idFormaIngresoAudiencia!: string;

  @Column({ type: 'uuid' })
  idJuzgado!: string;

  @Column({ type: 'uuid' })
  idJuezJuzgado!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreJuez?: string;

  @Column({ type: 'uuid' })
  idTipoAudiencia!: string;

  @Column({ type: 'uuid' })
  idModalidadAudiencia!: string;

  @Column({ type: 'uuid', nullable: true })
  idResolucionAudiencia?: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  observaciones?: string;

  @Column({ type: 'uuid' })
  idProximaAudiencia!: string;

  @Column({ type: 'timestamptz', nullable: true })
  fechaSiguienteAudiencia?: Date;


  /**
   * Validación inicial Confirmar/Descartar (decisión del equipo 2026-08-11,
   * P10 del PLAN): PENDIENTE al crear; una vez CONFIRMADO o DESCARTADO el
   * registro no admite más cambios.
   */
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estadoRevision!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idAudiencia) this.idAudiencia = uuidv7();
  }
}

/** Tabla traslados (§3.8). El estatus es FK a estatus_traslado (RF-TRA-005). */
@Entity('traslados')
export class Traslado {
  @PrimaryColumn('uuid')
  idTraslado!: string;

  @Index()
  @Column({ type: 'uuid' })
  idPersona!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  @Column({ type: 'uuid' })
  idTipoTraslado!: string;

  @Column({ type: 'uuid' })
  idDestinoTraslado!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  descripcion?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  unidades?: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  observaciones?: string;

  @Column({ type: 'uuid' })
  idEstatusTraslado!: string;


  /**
   * Validación inicial Confirmar/Descartar (decisión del equipo 2026-08-11,
   * P10 del PLAN): PENDIENTE al crear; una vez CONFIRMADO o DESCARTADO el
   * registro no admite más cambios.
   */
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estadoRevision!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idTraslado) this.idTraslado = uuidv7();
  }
}

/**
 * Tablas asociativas (§4.1 y §4.2). La PK compuesta impide registrar dos
 * veces la misma combinación (RF-ELE-005, RF-AUD-006, RF-TRA-006).
 */
@Entity('audiencias_elementos')
export class AudienciaElemento {
  @PrimaryColumn('uuid')
  idAudiencia!: string;

  @PrimaryColumn('uuid')
  idElemento!: string;
}

@Entity('traslados_elementos')
export class TrasladoElemento {
  @PrimaryColumn('uuid')
  idTraslado!: string;

  @PrimaryColumn('uuid')
  idElemento!: string;
}
