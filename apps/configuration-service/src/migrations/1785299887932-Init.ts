import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1785299887932 implements MigrationInterface {
    name = 'Init1785299887932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL, "routing_key" character varying NOT NULL, "event" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
        await queryRunner.query(`CREATE TABLE "inbox_events" ("eventId" uuid NOT NULL, "consumer" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a23c9e45f9b8dbcd23c91e2a855" PRIMARY KEY ("eventId", "consumer"))`);
        await queryRunner.query(`CREATE TABLE "institutions" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "code" character varying NOT NULL, "name" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0be7539dcdba335470dc05e9690" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5e33fad17fe34f0efc352ea92" ON "institutions" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_64f597a59141644416c277e2e9" ON "institutions" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3617f5ad52593fd4355b38d03a" ON "institutions" ("code") `);
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "institution_id" character varying NOT NULL, "name" character varying NOT NULL, "address" character varying, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fda619979f40a6a44fc9baf02c" ON "branches" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c282c21c4d268004d18b46063d" ON "branches" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_319f0f63c7ef90bec51825bcd3" ON "branches" ("institution_id") `);
        await queryRunner.query(`CREATE TABLE "operational_users" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "institution_id" character varying NOT NULL, "branch_id" character varying, "auth_user_id" character varying, "fullName" character varying NOT NULL, "roleIds" text NOT NULL DEFAULT '', CONSTRAINT "PK_46269dcbfa48189a5af19fe501c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d7c84ca946d956ce9e3881c7c7" ON "operational_users" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_749c9e3e4bf563d54d4a01b12d" ON "operational_users" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c35837bdd287f97aac88fa675" ON "operational_users" ("institution_id") `);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "key" character varying NOT NULL, "description" character varying, CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c9d5c0d09e27afdb707a2a8837" ON "permissions" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6ef0ccf568a1ecf514c44137a" ON "permissions" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_017943867ed5ceef9c03edd974" ON "permissions" ("key") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "name" character varying NOT NULL, "permissionKeys" text NOT NULL DEFAULT '', CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e59a01f4fe46ebbece575d9a0f" ON "roles" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0f08d7464db005c5d00bdf697f" ON "roles" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON "roles" ("name") `);
        await queryRunner.query(`CREATE TABLE "catalogs" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "catalog" character varying NOT NULL, "key" character varying NOT NULL, "label" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_1883399275415ee6107413fe6c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f5c236c4b6a7c96e439dd9792a" ON "catalogs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ee3bb2126cb95c3560ba06132" ON "catalogs" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ab269f37313dea06801ca37a1e" ON "catalogs" ("catalog") `);
        await queryRunner.query(`CREATE TABLE "parameters" ("id" uuid NOT NULL, "tenant_id" uuid, "organizational_unit_id" uuid, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "key" character varying NOT NULL, "value" jsonb NOT NULL, CONSTRAINT "PK_6b03a26baa3161f87fa87588859" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_818c1682b90a0a6344a37e01b7" ON "parameters" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_026f0f02362868d0ae425cb287" ON "parameters" ("organizational_unit_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_161354b92a4dcf3dd6008ddc74" ON "parameters" ("key") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_161354b92a4dcf3dd6008ddc74"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_026f0f02362868d0ae425cb287"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_818c1682b90a0a6344a37e01b7"`);
        await queryRunner.query(`DROP TABLE "parameters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab269f37313dea06801ca37a1e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ee3bb2126cb95c3560ba06132"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f5c236c4b6a7c96e439dd9792a"`);
        await queryRunner.query(`DROP TABLE "catalogs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_648e3f5447f725579d7d4ffdfb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0f08d7464db005c5d00bdf697f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e59a01f4fe46ebbece575d9a0f"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_017943867ed5ceef9c03edd974"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6ef0ccf568a1ecf514c44137a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9d5c0d09e27afdb707a2a8837"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c35837bdd287f97aac88fa675"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_749c9e3e4bf563d54d4a01b12d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d7c84ca946d956ce9e3881c7c7"`);
        await queryRunner.query(`DROP TABLE "operational_users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_319f0f63c7ef90bec51825bcd3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c282c21c4d268004d18b46063d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fda619979f40a6a44fc9baf02c"`);
        await queryRunner.query(`DROP TABLE "branches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3617f5ad52593fd4355b38d03a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64f597a59141644416c277e2e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5e33fad17fe34f0efc352ea92"`);
        await queryRunner.query(`DROP TABLE "institutions"`);
        await queryRunner.query(`DROP TABLE "inbox_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
    }

}
