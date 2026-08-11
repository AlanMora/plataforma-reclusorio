import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coordenadas de los centros penitenciarios para el módulo de mapa
 * (decisión del equipo 2026-08-11 — desviación P9 registrada en el PLAN).
 */
export class CentroCoordenadas1786480000000 implements MigrationInterface {
  name = 'CentroCoordenadas1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "centros" ADD "latitud" double precision`);
    await queryRunner.query(`ALTER TABLE "centros" ADD "longitud" double precision`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "centros" DROP COLUMN "longitud"`);
    await queryRunner.query(`ALTER TABLE "centros" DROP COLUMN "latitud"`);
  }
}
