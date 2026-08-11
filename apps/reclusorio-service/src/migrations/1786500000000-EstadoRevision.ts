import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLAS = ['ingreso_egreso', 'movimientos', 'audiencias', 'traslados', 'incidencias'];

/**
 * Validación inicial Confirmar/Descartar (P10 del PLAN, decisión del equipo
 * 2026-08-11): cada registro operativo nace PENDIENTE y se confirma o
 * descarta una única vez; después no admite cambios.
 */
export class EstadoRevision1786500000000 implements MigrationInterface {
  name = 'EstadoRevision1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of TABLAS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ADD "estadoRevision" character varying(20) NOT NULL DEFAULT 'PENDIENTE'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of [...TABLAS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${tabla}" DROP COLUMN "estadoRevision"`);
    }
  }
}
