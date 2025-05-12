/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInBase1746191583809 implements MigrationInterface {
    name = 'ChangesInBase1746191583809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."scoped_access_accesslevels_enum" AS ENUM('BUSINESS', 'OFFICE', 'DEPARTMENT', 'TEAM', 'PERSONAL', 'RELATED')`);
        await queryRunner.query(`CREATE TYPE "public"."scoped_access_entitystatus_enum" AS ENUM('0', '1')`);
        await queryRunner.query(`CREATE TABLE "scoped_access" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "accessLevels" "public"."scoped_access_accesslevels_enum" array NOT NULL DEFAULT '{BUSINESS}', "entityStatus" "public"."scoped_access_entitystatus_enum" DEFAULT '1', "businessId" integer, "roleGuardId" integer, CONSTRAINT "UQ_81c7fd63a3ae35a76d6f159fe91" UNIQUE ("businessId", "roleGuardId"), CONSTRAINT "PK_e33371651cd646abbbaec525877" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_relations" ("id" SERIAL NOT NULL, "entityType" character varying NOT NULL, "entityId" integer NOT NULL, "relationType" character varying, "userId" integer, CONSTRAINT "PK_52ecb2928c8b0df5fea41598f1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "createdById" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "deletedById" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "updatedById" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "businessId" integer`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ADD CONSTRAINT "FK_5d831c0c7aaa4a55de990fa8607" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ADD CONSTRAINT "FK_7aaa55c5ca807e307c868bb2a54" FOREIGN KEY ("roleGuardId") REFERENCES "RoleGuardEntity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_51d635f1d983d505fb5a2f44c52" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_e9d50c91bd84f566ce0ac1acf44" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_52e97c477859f8019f3705abd21" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_78725ac7117e7526e028014606b" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_relations" ADD CONSTRAINT "FK_df302653adcd575f87840ae0927" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_relations" DROP CONSTRAINT "FK_df302653adcd575f87840ae0927"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_78725ac7117e7526e028014606b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_52e97c477859f8019f3705abd21"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_e9d50c91bd84f566ce0ac1acf44"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_51d635f1d983d505fb5a2f44c52"`);
        await queryRunner.query(`ALTER TABLE "scoped_access" DROP CONSTRAINT "FK_7aaa55c5ca807e307c868bb2a54"`);
        await queryRunner.query(`ALTER TABLE "scoped_access" DROP CONSTRAINT "FK_5d831c0c7aaa4a55de990fa8607"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "businessId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedById"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedById"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdById"`);
        await queryRunner.query(`DROP TABLE "user_relations"`);
        await queryRunner.query(`DROP TABLE "scoped_access"`);
        await queryRunner.query(`DROP TYPE "public"."scoped_access_entitystatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."scoped_access_accesslevels_enum"`);
    }

}
