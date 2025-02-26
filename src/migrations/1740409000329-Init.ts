/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1740409000329 implements MigrationInterface {
    name = 'Init1740409000329'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."RoleGuardEntity_roles_enum" AS ENUM('SUPER', 'PRINCIPAL', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'AGENT', 'USER')`);
        await queryRunner.query(`CREATE TYPE "public"."RoleGuardEntity_entitystatus_enum" AS ENUM('0', '1')`);
        await queryRunner.query(`CREATE TABLE "RoleGuardEntity" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "queryOrEndPointURL" character varying NOT NULL, "type" character varying NOT NULL DEFAULT '', "description" character varying NOT NULL DEFAULT '', "roles" "public"."RoleGuardEntity_roles_enum" array, "entityStatus" "public"."RoleGuardEntity_entitystatus_enum" DEFAULT '1', CONSTRAINT "UQ_c684f057fde9a130a86b3e87e44" UNIQUE ("queryOrEndPointURL"), CONSTRAINT "PK_b1343c076dd868174e06307ce77" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."config_category_enum" AS ENUM('GENERAL', 'SECURITY', 'FRONTEND', 'SYSTEM')`);
        await queryRunner.query(`CREATE TYPE "public"."config_configvisibility_enum" AS ENUM('0', '1')`);
        await queryRunner.query(`CREATE TYPE "public"."config_configstatus_enum" AS ENUM('0', '1')`);
        await queryRunner.query(`CREATE TABLE "config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "category" "public"."config_category_enum" NOT NULL DEFAULT 'GENERAL', "group" character varying NOT NULL, "description" character varying, "values" jsonb, "configVisibility" "public"."config_configvisibility_enum" NOT NULL DEFAULT '1', "configStatus" "public"."config_configstatus_enum" DEFAULT '1', CONSTRAINT "UQ_fb63863dfa23f831c1a70a359b3" UNIQUE ("group"), CONSTRAINT "PK_d0ee79a681413d50b0a4f98cf7b" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "config"`);
        await queryRunner.query(`DROP TYPE "public"."config_configstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."config_configvisibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."config_category_enum"`);
        await queryRunner.query(`DROP TABLE "RoleGuardEntity"`);
        await queryRunner.query(`DROP TYPE "public"."RoleGuardEntity_entitystatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."RoleGuardEntity_roles_enum"`);
    }

}
