import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeliveryToSale1776784115321 implements MigrationInterface {
    name = 'AddDeliveryToSale1776784115321'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "hasDelivery" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "deliveryNotes" text`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "deliveryWorkerId" integer`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_245e7794c1a23be65a43d52ecb0" FOREIGN KEY ("deliveryWorkerId") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_245e7794c1a23be65a43d52ecb0"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "deliveryWorkerId"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "deliveryNotes"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "hasDelivery"`);
    }

}
