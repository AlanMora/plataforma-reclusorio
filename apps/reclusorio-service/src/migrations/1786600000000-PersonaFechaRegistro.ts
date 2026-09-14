import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonaFechaRegistro1786600000000 implements MigrationInterface {
  name = 'PersonaFechaRegistro1786600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "personas" ADD "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "personas" DROP COLUMN "fechaRegistro"');
  }
}
