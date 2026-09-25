import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P5: bitácora de dominio (auditoría técnica fuera del esquema del Modelo de
 * Datos Consolidado). Una fila por cambio con usuario, acción, registro,
 * valores antes/después, IP y correlationId.
 */
export class Bitacora1786800000000 implements MigrationInterface {
  name = 'Bitacora1786800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bitacora" (
        "idBitacora" uuid NOT NULL,
        "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "idUsuario" uuid,
        "usuario" character varying(150),
        "accion" character varying(30) NOT NULL,
        "entidad" character varying(100) NOT NULL,
        "idRegistro" character varying(255) NOT NULL,
        "cambios" jsonb,
        "operacion" character varying(255),
        "ip" character varying(64),
        "correlationId" character varying(100),
        CONSTRAINT "PK_18465fe9b488b2ebfa627160f63" PRIMARY KEY ("idBitacora")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_ca0064f2a610036de552bf5e0c" ON "bitacora" ("fecha")');
    await queryRunner.query('CREATE INDEX "IDX_3d2ce4affc6030b6ccfedd13f5" ON "bitacora" ("idUsuario")');
    await queryRunner.query('CREATE INDEX "IDX_585bc94e191f22a4e867e13a69" ON "bitacora" ("accion")');
    await queryRunner.query(
      'CREATE INDEX "IDX_ac7bac8bb1fb2ab42fe8bacd25" ON "bitacora" ("entidad", "idRegistro")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "bitacora"');
  }
}
