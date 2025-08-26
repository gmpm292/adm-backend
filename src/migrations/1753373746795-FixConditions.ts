/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class FixConditions1753373746795 implements MigrationInterface {
    name = 'FixConditions1753373746795'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."py_payment_rules_workertype_enum" RENAME TO "py_payment_rules_workertype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."py_payment_rules_workertype_enum" AS ENUM('PUBLICIST', 'ECONOMIC', 'SERVICE', 'COURIER', 'TECHNICIAN', 'OPERATIVE', 'PRINCIPAL', 'ADMINISTRATIVE', 'MANAGER', 'SUPERVISOR', 'AGENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ALTER COLUMN "workerType" TYPE "public"."py_payment_rules_workertype_enum" USING "workerType"::"text"::"public"."py_payment_rules_workertype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."py_payment_rules_workertype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."py_payment_rules_workertype_enum_old" AS ENUM('AGENT', 'PUBLICIST', 'ECONOMIC', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ALTER COLUMN "workerType" TYPE "public"."py_payment_rules_workertype_enum_old" USING "workerType"::"text"::"public"."py_payment_rules_workertype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."py_payment_rules_workertype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."py_payment_rules_workertype_enum_old" RENAME TO "py_payment_rules_workertype_enum"`);
    }

}
