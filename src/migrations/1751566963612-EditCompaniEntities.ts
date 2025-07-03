/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class EditCompaniEntities1751566963612 implements MigrationInterface {
    name = 'EditCompaniEntities1751566963612'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "co_teams" ADD "businessId" integer`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD "officeId" integer`);
        await queryRunner.query(`ALTER TABLE "co_departments" ADD "businessId" integer`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD CONSTRAINT "FK_20dfad7e69290aea562ee1cfc25" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD CONSTRAINT "FK_4f22d6790a88313469647ab17b1" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "co_departments" ADD CONSTRAINT "FK_4d8846defbe19494bea324f723a" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "co_departments" DROP CONSTRAINT "FK_4d8846defbe19494bea324f723a"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP CONSTRAINT "FK_4f22d6790a88313469647ab17b1"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP CONSTRAINT "FK_20dfad7e69290aea562ee1cfc25"`);
        await queryRunner.query(`ALTER TABLE "co_departments" DROP COLUMN "businessId"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP COLUMN "officeId"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP COLUMN "businessId"`);
    }

}
