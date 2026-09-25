import { MigrationInterface, QueryRunner } from "typeorm";

/** Nombre completo opcional del usuario, para identificarlo cuando su usuario es un apodo. */
export class NombreUsuario1790000000001 implements MigrationInterface {
    name = 'NombreUsuario1790000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "nombre" character varying(150)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nombre"`);
    }

}
