/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeTypeOfEffectiveDate1759426078613 implements MigrationInterface {
    name = 'ChangeTypeOfEffectiveDate1759426078613'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "effectiveDate"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "effectiveDate" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "effectiveDate"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "effectiveDate" TIME`);
    }

}
