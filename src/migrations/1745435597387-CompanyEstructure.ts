/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyEstructure1745435597387 implements MigrationInterface {
    name = 'CompanyEstructure1745435597387'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."co_teams_teamtype_enum" AS ENUM('GROUP_A', 'GROUP_B')`);
        await queryRunner.query(`CREATE TABLE "co_teams" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "teamType" "public"."co_teams_teamtype_enum", "departmentId" integer, CONSTRAINT "PK_aa799991dcfadf9ff6fd5ac3aa2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."co_departments_departmenttype_enum" AS ENUM('ECONOMIC', 'SALES', 'ADMINISTRATION')`);
        await queryRunner.query(`CREATE TABLE "co_departments" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "departmentType" "public"."co_departments_departmenttype_enum", "name" character varying, "description" character varying, "address" character varying, "officeId" integer, CONSTRAINT "PK_eed785220fc8a60d4a96035d5d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "co_businesses" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "taxId" character varying, "address" character varying, "contactPhone" character varying, "contactEmail" character varying, CONSTRAINT "PK_a320634655eacf9f6dd6272508e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."co_offices_officetype_enum" AS ENUM('OFFICE', 'BRANCH')`);
        await queryRunner.query(`CREATE TABLE "co_offices" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "officeType" "public"."co_offices_officetype_enum" DEFAULT 'OFFICE', "name" character varying NOT NULL, "description" character varying NOT NULL, "address" character varying NOT NULL, "businessId" integer, CONSTRAINT "PK_35ee7faded9c46b3e8e864ccf1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "officeId" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "departmentId" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "teamId" integer`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD CONSTRAINT "FK_628a47f68c2ef7155161404566d" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "co_departments" ADD CONSTRAINT "FK_8d760b7db78058da57efbe5203a" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "co_offices" ADD CONSTRAINT "FK_27411fbe7b1e161896fb4b0e2da" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_f7f69295d570c80f210703300f1" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_554d853741f2083faaa5794d2ae" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_d1803064187c8f38e57a9c4984c" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_d1803064187c8f38e57a9c4984c"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_554d853741f2083faaa5794d2ae"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_f7f69295d570c80f210703300f1"`);
        await queryRunner.query(`ALTER TABLE "co_offices" DROP CONSTRAINT "FK_27411fbe7b1e161896fb4b0e2da"`);
        await queryRunner.query(`ALTER TABLE "co_departments" DROP CONSTRAINT "FK_8d760b7db78058da57efbe5203a"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP CONSTRAINT "FK_628a47f68c2ef7155161404566d"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "teamId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "departmentId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "officeId"`);
        await queryRunner.query(`DROP TABLE "co_offices"`);
        await queryRunner.query(`DROP TYPE "public"."co_offices_officetype_enum"`);
        await queryRunner.query(`DROP TABLE "co_businesses"`);
        await queryRunner.query(`DROP TABLE "co_departments"`);
        await queryRunner.query(`DROP TYPE "public"."co_departments_departmenttype_enum"`);
        await queryRunner.query(`DROP TABLE "co_teams"`);
        await queryRunner.query(`DROP TYPE "public"."co_teams_teamtype_enum"`);
    }

}
