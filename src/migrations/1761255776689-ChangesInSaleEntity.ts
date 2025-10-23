/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInSaleEntity1761255776689 implements MigrationInterface {
    name = 'ChangesInSaleEntity1761255776689'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "isConfirmed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "isConfirmed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "isConfirmed"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "isConfirmed"`);
    }

}
