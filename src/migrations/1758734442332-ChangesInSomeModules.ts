/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInSomeModules1758734442332 implements MigrationInterface {
    name = 'ChangesInSomeModules1758734442332'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "otherType" text`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "paymentCurrency" character varying(3) NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."py_payment_rules_scope_enum" AS ENUM('GENERAL', 'BUSINESS', 'OFFICE', 'DEPARTMENT', 'TEAM', 'PERSONAL', 'RELATED')`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "scope" "public"."py_payment_rules_scope_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "distributeProfits" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "productId" integer`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD "categoryId" integer`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "otherType" text`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" ADD "name" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."py_payment_rules_workertype_enum" RENAME TO "py_payment_rules_workertype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."py_payment_rules_workertype_enum" AS ENUM('PUBLICIST', 'ECONOMIC', 'SERVICE', 'COURIER', 'TECHNICIAN', 'OPERATIVE', 'COMMUNITY_MANAGER', 'PRINCIPAL', 'ADMINISTRATIVE', 'MANAGER', 'SUPERVISOR', 'AGENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ALTER COLUMN "workerType" TYPE "public"."py_payment_rules_workertype_enum" USING "workerType"::"text"::"public"."py_payment_rules_workertype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."py_payment_rules_workertype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_a9cc8dd86cc7e32169cde69a610" FOREIGN KEY ("productId") REFERENCES "in_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_3c3a9f3683cf79d0d63ce254f9e" FOREIGN KEY ("categoryId") REFERENCES "in_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_3c3a9f3683cf79d0d63ce254f9e"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_a9cc8dd86cc7e32169cde69a610"`);
        await queryRunner.query(`CREATE TYPE "public"."py_payment_rules_workertype_enum_old" AS ENUM('PUBLICIST', 'ECONOMIC', 'SERVICE', 'COURIER', 'TECHNICIAN', 'OPERATIVE', 'PRINCIPAL', 'ADMINISTRATIVE', 'MANAGER', 'SUPERVISOR', 'AGENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" ALTER COLUMN "workerType" TYPE "public"."py_payment_rules_workertype_enum_old" USING "workerType"::"text"::"public"."py_payment_rules_workertype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."py_payment_rules_workertype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."py_payment_rules_workertype_enum_old" RENAME TO "py_payment_rules_workertype_enum"`);
        await queryRunner.query(`ALTER TABLE "py_work_schedules" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "otherType"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "categoryId"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "productId"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "distributeProfits"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "scope"`);
        await queryRunner.query(`DROP TYPE "public"."py_payment_rules_scope_enum"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "paymentCurrency"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rules" DROP COLUMN "otherType"`);
    }

}
