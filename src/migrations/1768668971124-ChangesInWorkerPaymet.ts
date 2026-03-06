/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInWorkerPaymet1768668971124 implements MigrationInterface {
    name = 'ChangesInWorkerPaymet1768668971124'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "payment_rule_id" integer`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_d4091d7faa28d09375ac0ca4bf1" FOREIGN KEY ("payment_rule_id") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_d4091d7faa28d09375ac0ca4bf1"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "payment_rule_id"`);
    }

}
