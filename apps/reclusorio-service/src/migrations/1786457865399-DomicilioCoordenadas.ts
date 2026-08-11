import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coordenadas del domicilio (latitud/longitud) capturadas desde el mapa del
 * frontend. Decisión del equipo 2026-08-11 — campos fuera del Modelo de Datos
 * Consolidado v1.0, registrados como desviación aprobada en el PLAN.
 */
export class DomicilioCoordenadas1786457865399 implements MigrationInterface {
  name = 'DomicilioCoordenadas1786457865399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domicilios" ADD "latitud" double precision`);
    await queryRunner.query(`ALTER TABLE "domicilios" ADD "longitud" double precision`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domicilios" DROP COLUMN "longitud"`);
    await queryRunner.query(`ALTER TABLE "domicilios" DROP COLUMN "latitud"`);
  }
}
