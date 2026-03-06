/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInRelations1770413168665 implements MigrationInterface {
    name = 'ChangesInRelations1770413168665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_af447e800ea34b11d0c6415ab0e"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_d4091d7faa28d09375ac0ca4bf1"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_768bfd7d64fb61b41bf76b23eab"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_a7157f18cab59c232eed7b76e37"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_98455634110105ea3d1fd875a79"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_f241a73cb7802b20b0344d15a2f"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" RENAME COLUMN "work_schedule_id" TO "workScheduleId"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "sale_id"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "payment_rule_id"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "worker_id"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "payment_rule_id"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "payroll_period_id"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "saleId" integer`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "paymentRuleId" integer`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "workerId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "paymentRuleId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "payrollPeriodId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_dda49f580ccf654fd8eb61cd636" FOREIGN KEY ("saleId") REFERENCES "sl_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_ee2d4ff29c441639be4ae6d2a27" FOREIGN KEY ("paymentRuleId") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_f73a0813088c02141367d396446" FOREIGN KEY ("workerId") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_acf0b3eafb09b4ee6cc13b98697" FOREIGN KEY ("paymentRuleId") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_a5edaac82f42b6b417f74dd36ec" FOREIGN KEY ("payrollPeriodId") REFERENCES "py_payroll_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_bee0f0f915e82288ff3627ab338" FOREIGN KEY ("workScheduleId") REFERENCES "py_work_schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_bee0f0f915e82288ff3627ab338"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_a5edaac82f42b6b417f74dd36ec"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_acf0b3eafb09b4ee6cc13b98697"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_f73a0813088c02141367d396446"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_ee2d4ff29c441639be4ae6d2a27"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_dda49f580ccf654fd8eb61cd636"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "payrollPeriodId"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "paymentRuleId"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP COLUMN "workerId"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "paymentRuleId"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "saleId"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "payroll_period_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "payment_rule_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD "worker_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "payment_rule_id" integer`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "sale_id" integer`);
        await queryRunner.query(`ALTER TABLE "py_attendances" RENAME COLUMN "workScheduleId" TO "work_schedule_id"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_f241a73cb7802b20b0344d15a2f" FOREIGN KEY ("work_schedule_id") REFERENCES "py_work_schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_98455634110105ea3d1fd875a79" FOREIGN KEY ("payroll_period_id") REFERENCES "py_payroll_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_a7157f18cab59c232eed7b76e37" FOREIGN KEY ("payment_rule_id") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_768bfd7d64fb61b41bf76b23eab" FOREIGN KEY ("worker_id") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_d4091d7faa28d09375ac0ca4bf1" FOREIGN KEY ("payment_rule_id") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_af447e800ea34b11d0c6415ab0e" FOREIGN KEY ("sale_id") REFERENCES "sl_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
