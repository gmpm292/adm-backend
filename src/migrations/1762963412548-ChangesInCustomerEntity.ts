/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInCustomerEntity1762963412548 implements MigrationInterface {
    name = 'ChangesInCustomerEntity1762963412548'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_customers" ADD "lastName" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "sl_customers" ADD "fullName" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "sl_customers" ADD "ci" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_customers" DROP COLUMN "ci"`);
        await queryRunner.query(`ALTER TABLE "sl_customers" DROP COLUMN "fullName"`);
        await queryRunner.query(`ALTER TABLE "sl_customers" DROP COLUMN "lastName"`);
    }

}
