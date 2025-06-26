/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class EditConfigEnums1750969322241 implements MigrationInterface {
    name = 'EditConfigEnums1750969322241'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."config_configvisibility_enum" RENAME TO "config_configvisibility_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."config_configvisibility_enum" AS ENUM('PRIVATE', 'PUBLIC')`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" TYPE "public"."config_configvisibility_enum" USING "configVisibility"::"text"::"public"."config_configvisibility_enum"`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" SET DEFAULT 'PUBLIC'`);
        await queryRunner.query(`DROP TYPE "public"."config_configvisibility_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."config_configstatus_enum" RENAME TO "config_configstatus_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."config_configstatus_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" TYPE "public"."config_configstatus_enum" USING "configStatus"::"text"::"public"."config_configstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" SET DEFAULT 'ENABLED'`);
        await queryRunner.query(`DROP TYPE "public"."config_configstatus_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."config_configstatus_enum_old" AS ENUM('0', '1')`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" TYPE "public"."config_configstatus_enum_old" USING "configStatus"::"text"::"public"."config_configstatus_enum_old"`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configStatus" SET DEFAULT '1'`);
        await queryRunner.query(`DROP TYPE "public"."config_configstatus_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."config_configstatus_enum_old" RENAME TO "config_configstatus_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."config_configvisibility_enum_old" AS ENUM('0', '1')`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" TYPE "public"."config_configvisibility_enum_old" USING "configVisibility"::"text"::"public"."config_configvisibility_enum_old"`);
        await queryRunner.query(`ALTER TABLE "config" ALTER COLUMN "configVisibility" SET DEFAULT '1'`);
        await queryRunner.query(`DROP TYPE "public"."config_configvisibility_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."config_configvisibility_enum_old" RENAME TO "config_configvisibility_enum"`);
    }

}
