import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1785299899478 implements MigrationInterface {
    name = 'Init1785299899478'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "bucket" character varying NOT NULL, "object_key" character varying NOT NULL, "original_name" character varying NOT NULL, "content_type" character varying NOT NULL, "size" bigint NOT NULL, "fileVersion" integer NOT NULL DEFAULT '1', "antivirus_status" character varying NOT NULL DEFAULT 'pending', CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_484acb2ff8f3e134dfac8f01e8" ON "files" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_61011aaf5e9bd5bfd6288deb70" ON "files" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61011aaf5e9bd5bfd6288deb70"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_484acb2ff8f3e134dfac8f01e8"`);
        await queryRunner.query(`DROP TABLE "files"`);
    }

}
