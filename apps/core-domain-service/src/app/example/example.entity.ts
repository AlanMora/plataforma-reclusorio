import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@icms/database';

/**
 * Entidad de ejemplo del dominio. Sustitúyela por las entidades principales de
 * tu proyecto. Muestra el patrón: extiende BaseEntity (id, timestamps,
 * soft-delete, version) y define columnas de negocio.
 */
@Entity('example_entities')
export class ExampleEntity extends BaseEntity {
  @Column()
  name!: string;

  @Column({ default: 'draft' })
  status!: string; // draft | active | archived (ejemplo de flujo de estados)

  @Column('jsonb', { nullable: true })
  attributes?: Record<string, unknown>;
}
