/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class SaleRefunds1771881309025 implements MigrationInterface {
    name = 'SaleRefunds1771881309025'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."sl_sales_salestatus_enum" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED')`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "saleStatus" "public"."sl_sales_salestatus_enum" NOT NULL DEFAULT 'DRAFT'`);
        await queryRunner.query(`CREATE TYPE "public"."sl_sale_details_saledetailstatus_enum" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'REFUNDED')`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "saleDetailStatus" "public"."sl_sale_details_saledetailstatus_enum" NOT NULL DEFAULT 'DRAFT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "saleDetailStatus"`);
        await queryRunner.query(`DROP TYPE "public"."sl_sale_details_saledetailstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "saleStatus"`);
        await queryRunner.query(`DROP TYPE "public"."sl_sales_salestatus_enum"`);
    }

}
