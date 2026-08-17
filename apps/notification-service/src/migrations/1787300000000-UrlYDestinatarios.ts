import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campana en tiempo real: la bandeja gana el destino del "Ver" (url) y se
 * crea la proyección de destinatarios para las difusiones (`to: '*'`).
 */
export class UrlYDestinatarios1787300000000 implements MigrationInterface {
  name = 'UrlYDestinatarios1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notifications" ADD COLUMN IF NOT EXISTS "url" character varying(500)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "notification_recipients" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "user_id" character varying NOT NULL, "email" character varying, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_notification_recipients" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_recipients_user" ON "notification_recipients" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_recipients"`);
    await queryRunner.query(`ALTER TABLE "user_notifications" DROP COLUMN IF EXISTS "url"`);
  }
}
