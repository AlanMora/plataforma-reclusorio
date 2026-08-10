import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1786404412159 implements MigrationInterface {
    name = 'Init1786404412159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_notifications" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "user_id" character varying NOT NULL, "titulo" character varying, "mensaje" character varying(2000) NOT NULL, "leida" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_569622b0fd6e6ab3661de985a2b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_14c3aac4fa45210bfd61640e67" ON "user_notifications" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_336aa448502f168a3a265cf639" ON "user_notifications" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae9b1d1f1fe780ef8e3e7d0c0f" ON "user_notifications" ("user_id") `);
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
        await queryRunner.query(`DROP INDEX "public"."IDX_ae9b1d1f1fe780ef8e3e7d0c0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_336aa448502f168a3a265cf639"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_14c3aac4fa45210bfd61640e67"`);
        await queryRunner.query(`DROP TABLE "user_notifications"`);
    }

}
