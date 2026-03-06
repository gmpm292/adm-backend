/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInDateTypes1768846366139 implements MigrationInterface {
    name = 'ChangesInDateTypes1768846366139'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" ADD "startDate" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" ADD "endDate" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" ADD "startDate" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" ADD "endDate" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP COLUMN "attendanceDate"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD "attendanceDate" TIMESTAMP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP COLUMN "attendanceDate"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD "attendanceDate" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" ADD "endDate" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" ADD "startDate" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" ADD "endDate" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "py_payroll_periods" ADD "startDate" date NOT NULL`);
    }

}
