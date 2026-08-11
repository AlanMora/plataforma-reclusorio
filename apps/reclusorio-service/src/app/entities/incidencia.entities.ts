import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Tabla incidencias (§3.9): hechos ocurridos en el centro penitenciario.
 * Puede existir SIN personas asociadas (RF-INC-001) y relacionarse con
 * múltiples personas, autoridades y elementos vía tablas asociativas.
 *
 * primerRespondiente (texto) conserva el nombre libre cuando el elemento
 * no está registrado; cuando sí existe, la relación formal va en
 * incidencias_elementos con primerRespondiente = true (RF-INC-007).
 */
@Entity('incidencias')
export class Incidencia {
  @PrimaryColumn('uuid')
  idIncidencia!: string;

  @Index()
  @Column({ type: 'uuid' })
  idCentroPenitenciario!: string;

  @Column({ type: 'timestamptz' })
  fecha!: Date;

  @Column({ type: 'uuid' })
  idTipoIncidencia!: string;

  @Column({ type: 'varchar', length: 2000 })
  descripcion!: string;

  // Informe Policial Homologado (opcional).
  @Column({ type: 'varchar', length: 100, nullable: true })
  iph?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primerRespondiente?: string;

  @Column({ type: 'text', nullable: true })
  narrativa?: string;


  /**
   * Validación inicial Confirmar/Descartar (decisión del equipo 2026-08-11,
   * P10 del PLAN): PENDIENTE al crear; una vez CONFIRMADO o DESCARTADO el
   * registro no admite más cambios.
   */
  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estadoRevision!: string;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idIncidencia) this.idIncidencia = uuidv7();
  }
}

/** §4.3 — personas involucradas en una incidencia. */
@Entity('incidencias_personas')
export class IncidenciaPersona {
  @PrimaryColumn('uuid')
  idIncidencia!: string;

  @PrimaryColumn('uuid')
  idPersona!: string;
}

/** §4.4 — autoridades de apoyo que intervienen en una incidencia. */
@Entity('incidencias_autoridades')
export class IncidenciaAutoridad {
  @PrimaryColumn('uuid')
  idIncidencia!: string;

  @PrimaryColumn('uuid')
  idAutoridad!: string;
}

/** §4.5 — elementos participantes; marca al primer respondiente registrado. */
@Entity('incidencias_elementos')
export class IncidenciaElemento {
  @PrimaryColumn('uuid')
  idIncidencia!: string;

  @PrimaryColumn('uuid')
  idElemento!: string;

  @Column({ type: 'boolean', default: false })
  primerRespondiente!: boolean;
}
