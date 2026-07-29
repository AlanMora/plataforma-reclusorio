import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1785299897270 implements MigrationInterface {
    name = 'Init1785299897270'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "integration_outbox" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "destination" character varying NOT NULL, "operation" character varying NOT NULL, "payload" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" character varying, CONSTRAINT "PK_0807cd3d14577a948b136b138b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2595933c55be7b25c78d3f564e" ON "integration_outbox" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f582a877aae673178014fe393" ON "integration_outbox" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e522f8759b97b8673e2f606a7" ON "integration_outbox" ("destination") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4f438be470694d8eac8d8f2c7" ON "integration_outbox" ("status") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4f438be470694d8eac8d8f2c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e522f8759b97b8673e2f606a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f582a877aae673178014fe393"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2595933c55be7b25c78d3f564e"`);
        await queryRunner.query(`DROP TABLE "integration_outbox"`);
    }

}
