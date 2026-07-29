import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1785299894730 implements MigrationInterface {
    name = 'Init1785299894730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "channel" character varying NOT NULL, "to" character varying NOT NULL, "template" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" character varying, CONSTRAINT "PK_81daeff81f237bd384f7cfc4a4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3a8f3bef549f468f0ea16a37f0" ON "notification_deliveries" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ebd3603bf0504338abba2701d5" ON "notification_deliveries" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_97df328ebc040393a0fa5ff6b8" ON "notification_deliveries" ("channel") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97df328ebc040393a0fa5ff6b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ebd3603bf0504338abba2701d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a8f3bef549f468f0ea16a37f0"`);
        await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    }

}
