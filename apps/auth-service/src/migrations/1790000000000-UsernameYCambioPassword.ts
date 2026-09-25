import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * El acceso deja de ser por correo: `email` pasa a `username` (la parte antes
 * de la @, en minúsculas, salvo que choque con otro usuario — entonces se
 * conserva completo) y se agrega `must_change_password` para obligar a
 * cambiar la contraseña temporal en el primer ingreso.
 */
export class UsernameYCambioPassword1790000000000 implements MigrationInterface {
    name = 'UsernameYCambioPassword1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "email" TO "username"`);
        await queryRunner.query(`
            UPDATE "users" u
               SET "username" = lower(split_part(u."username", '@', 1))
             WHERE NOT EXISTS (
                   SELECT 1 FROM "users" o
                    WHERE o."id" <> u."id"
                      AND lower(split_part(o."username", '@', 1)) = lower(split_part(u."username", '@', 1)))
        `);
        await queryRunner.query(`UPDATE "users" SET "username" = lower("username")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "must_change_password" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "must_change_password"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "username" TO "email"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
    }

}
