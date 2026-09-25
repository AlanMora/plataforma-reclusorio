import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Bitácora de dominio (P5): auditoría TÉCNICA, fuera del esquema del Modelo
 * de Datos Consolidado. Cada fila es un cambio a una tabla del dominio
 * (alta, modificación o baja de una asociación) con quién lo hizo, desde
 * dónde y qué valores cambiaron. Solo se inserta: nunca se edita ni borra.
 */
@Entity('bitacora')
@Index(['entidad', 'idRegistro'])
export class Bitacora {
  @PrimaryColumn('uuid')
  idBitacora!: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  fecha!: Date;

  /** Usuario de acceso (auth-service) que originó el cambio. */
  @Index()
  @Column('uuid', { nullable: true })
  idUsuario!: string | null;

  @Column('varchar', { length: 150, nullable: true })
  usuario!: string | null;

  /** CREAR | MODIFICAR | QUITAR | CONFIRMAR | DESCARTAR | DESACTIVAR | REACTIVAR */
  @Index()
  @Column('varchar', { length: 30 })
  accion!: string;

  /** Tabla del dominio afectada, p. ej. personas, incidencias. */
  @Column('varchar', { length: 100 })
  entidad!: string;

  /** Llave primaria del registro afectado (compuesta = valores unidos por "|"). */
  @Column('varchar', { length: 255 })
  idRegistro!: string;

  /** CREAR: { despues }; MODIFICAR: { campo: { antes, despues } }; QUITAR: { antes }. */
  @Column('jsonb', { nullable: true })
  cambios!: Record<string, unknown> | null;

  /** Petición que lo originó, p. ej. "POST /api/v1/incidencias/:id/confirmar". */
  @Column('varchar', { length: 255, nullable: true })
  operacion!: string | null;

  @Column('varchar', { length: 64, nullable: true })
  ip!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  correlationId!: string | null;

  @BeforeInsert()
  asignarId(): void {
    if (!this.idBitacora) this.idBitacora = uuidv7();
  }
}
