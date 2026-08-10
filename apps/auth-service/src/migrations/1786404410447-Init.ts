import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1786404410447 implements MigrationInterface {
    name = 'Init1786404410447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "two_factor_enabled" boolean NOT NULL DEFAULT false, "roles" text NOT NULL DEFAULT '', "permissions" text NOT NULL DEFAULT '', CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_109638590074998bb72a2f2cf0" ON "users" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ccd41aa5096a12523add756d7" ON "users" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "security_audit_logs" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "user_id" character varying, "action" character varying NOT NULL, "outcome" character varying, "ip_address" character varying, "metadata" jsonb, CONSTRAINT "PK_c102bef9bbc2775cec64a76c675" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1b30e0e7907eb93de24aaae198" ON "security_audit_logs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae2560018372dbfd88e1e8c937" ON "security_audit_logs" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d7f3413ad98f1a72ef76e84bfe" ON "security_audit_logs" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d7f3413ad98f1a72ef76e84bfe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae2560018372dbfd88e1e8c937"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b30e0e7907eb93de24aaae198"`);
        await queryRunner.query(`DROP TABLE "security_audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ccd41aa5096a12523add756d7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_109638590074998bb72a2f2cf0"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
