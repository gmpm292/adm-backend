/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class UsersInheritance1741906537698 implements MigrationInterface {
    name = 'UsersInheritance1741906537698'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "type" character varying DEFAULT 'User'`);
        await queryRunner.query(`CREATE INDEX "IDX_94e2000b5f7ee1f9c491f0f8a8" ON "users" ("type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_94e2000b5f7ee1f9c491f0f8a8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "type"`);
    }

}
