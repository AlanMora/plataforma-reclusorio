import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1785299901780 implements MigrationInterface {
    name = 'Init1785299901780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "job_runs" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "job" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'running', "attempts" integer NOT NULL DEFAULT '0', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE, "error" character varying, CONSTRAINT "PK_4d0012c04fcfc287550b76be7e9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b52005eca5244d7a572d0cc4e2" ON "job_runs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1957b219dc6414b44798e00e7d" ON "job_runs" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c370c0e920974f9b3442e4767a" ON "job_runs" ("job") `);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c370c0e920974f9b3442e4767a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1957b219dc6414b44798e00e7d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b52005eca5244d7a572d0cc4e2"`);
        await queryRunner.query(`DROP TABLE "job_runs"`);
    }

}
