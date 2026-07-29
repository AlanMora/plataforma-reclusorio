import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Entidad base alineada al estándar de arquitectura (§19 Convenciones de datos):
 *  - id UUID v7 (ordenable por tiempo)
 *  - tenantId (+ organizationalUnitId cuando aplique) para aislamiento multi-tenant
 *  - createdBy / updatedBy para auditoría
 *  - timestamps en UTC (sufijo At), borrado lógico (deletedAt) y versión optimista
 *
 * Todas las entidades de negocio deben extenderla. El repositorio del servicio
 * es responsable de poblar tenantId/OU/actor desde el contexto de la petición.
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  @Index()
  @Column({ name: 'organizational_unit_id', type: 'uuid', nullable: true })
  organizationalUnitId?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @VersionColumn({ default: 1 })
  version!: number;

  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) this.id = uuidv7();
  }
}
