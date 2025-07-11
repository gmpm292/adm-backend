/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInEnum1752083184550 implements MigrationInterface {
    name = 'ChangesInEnum1752083184550'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."scoped_access_accesslevels_enum" RENAME TO "scoped_access_accesslevels_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."scoped_access_accesslevels_enum" AS ENUM('GENERAL', 'BUSINESS', 'OFFICE', 'DEPARTMENT', 'TEAM', 'PERSONAL', 'RELATED')`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" TYPE "public"."scoped_access_accesslevels_enum"[] USING "accessLevels"::"text"::"public"."scoped_access_accesslevels_enum"[]`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" SET DEFAULT '{BUSINESS}'`);
        await queryRunner.query(`DROP TYPE "public"."scoped_access_accesslevels_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."scoped_access_accesslevels_enum_old" AS ENUM('BUSINESS', 'OFFICE', 'DEPARTMENT', 'TEAM', 'PERSONAL', 'RELATED')`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" TYPE "public"."scoped_access_accesslevels_enum_old"[] USING "accessLevels"::"text"::"public"."scoped_access_accesslevels_enum_old"[]`);
        await queryRunner.query(`ALTER TABLE "scoped_access" ALTER COLUMN "accessLevels" SET DEFAULT '{BUSINESS}'`);
        await queryRunner.query(`DROP TYPE "public"."scoped_access_accesslevels_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."scoped_access_accesslevels_enum_old" RENAME TO "scoped_access_accesslevels_enum"`);
    }

}
