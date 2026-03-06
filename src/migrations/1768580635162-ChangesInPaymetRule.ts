/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInPaymetRule1768580635162 implements MigrationInterface {
    name = 'ChangesInPaymetRule1768580635162'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "py_payment_accumulators" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "productCounter" integer NOT NULL DEFAULT '0', "salesTotal" numeric(15,2) NOT NULL DEFAULT '0', "accumulatedAmount" numeric(15,2) NOT NULL DEFAULT '0', "accumulatedCurrency" numeric(15,2) NOT NULL DEFAULT '0', "metadata" json, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "worker_id" integer NOT NULL, "payment_rule_id" integer NOT NULL, "payroll_period_id" integer NOT NULL, CONSTRAINT "PK_99040fc1d4f7a02fd264775ebf9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "py_payment_rule_workers" ("payment_rule_id" integer NOT NULL, "worker_id" integer NOT NULL, CONSTRAINT "PK_14fbd78391c278ac17da86d5a99" PRIMARY KEY ("payment_rule_id", "worker_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c18ca0a484ecf510ebb98e8ff" ON "py_payment_rule_workers" ("payment_rule_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_73b11bbacdb1e6ca50b19aaff8" ON "py_payment_rule_workers" ("worker_id") `);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD "sale_id" integer`);
        await queryRunner.query(`ALTER TYPE "public"."py_worker_payments_paymentconcept_enum" RENAME TO "py_worker_payments_paymentconcept_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."py_worker_payments_paymentconcept_enum" AS ENUM('SALARY', 'COMMISSION', 'BONUS', 'DISCOUNT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ALTER COLUMN "paymentConcept" TYPE "public"."py_worker_payments_paymentconcept_enum" USING "paymentConcept"::"text"::"public"."py_worker_payments_paymentconcept_enum"`);
        await queryRunner.query(`DROP TYPE "public"."py_worker_payments_paymentconcept_enum_old"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_af447e800ea34b11d0c6415ab0e" FOREIGN KEY ("sale_id") REFERENCES "sl_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_57a183a2bcf5406509b82e90032" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_d1e8e236e005aa8b5f6837b64c9" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_0c6ebca71024266ded15cb99eb6" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_ad59e143546d2cdfb0645240714" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_b736d5871d53e6229f8799492a7" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_4b12291062c7b49ce6da6b134a1" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_0dcc6d4eae0d8a0818a2d7a6cfd" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_768bfd7d64fb61b41bf76b23eab" FOREIGN KEY ("worker_id") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_a7157f18cab59c232eed7b76e37" FOREIGN KEY ("payment_rule_id") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" ADD CONSTRAINT "FK_98455634110105ea3d1fd875a79" FOREIGN KEY ("payroll_period_id") REFERENCES "py_payroll_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_payment_rule_workers" ADD CONSTRAINT "FK_2c18ca0a484ecf510ebb98e8ff6" FOREIGN KEY ("payment_rule_id") REFERENCES "py_payment_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "py_payment_rule_workers" ADD CONSTRAINT "FK_73b11bbacdb1e6ca50b19aaff89" FOREIGN KEY ("worker_id") REFERENCES "py_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_payment_rule_workers" DROP CONSTRAINT "FK_73b11bbacdb1e6ca50b19aaff89"`);
        await queryRunner.query(`ALTER TABLE "py_payment_rule_workers" DROP CONSTRAINT "FK_2c18ca0a484ecf510ebb98e8ff6"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_98455634110105ea3d1fd875a79"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_a7157f18cab59c232eed7b76e37"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_768bfd7d64fb61b41bf76b23eab"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_0dcc6d4eae0d8a0818a2d7a6cfd"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_4b12291062c7b49ce6da6b134a1"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_b736d5871d53e6229f8799492a7"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_ad59e143546d2cdfb0645240714"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_0c6ebca71024266ded15cb99eb6"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_d1e8e236e005aa8b5f6837b64c9"`);
        await queryRunner.query(`ALTER TABLE "py_payment_accumulators" DROP CONSTRAINT "FK_57a183a2bcf5406509b82e90032"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_af447e800ea34b11d0c6415ab0e"`);
        await queryRunner.query(`CREATE TYPE "public"."py_worker_payments_paymentconcept_enum_old" AS ENUM('SALARY', 'COMMISSION', 'BONUS', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" ALTER COLUMN "paymentConcept" TYPE "public"."py_worker_payments_paymentconcept_enum_old" USING "paymentConcept"::"text"::"public"."py_worker_payments_paymentconcept_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."py_worker_payments_paymentconcept_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."py_worker_payments_paymentconcept_enum_old" RENAME TO "py_worker_payments_paymentconcept_enum"`);
        await queryRunner.query(`ALTER TABLE "py_worker_payments" DROP COLUMN "sale_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73b11bbacdb1e6ca50b19aaff8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c18ca0a484ecf510ebb98e8ff"`);
        await queryRunner.query(`DROP TABLE "py_payment_rule_workers"`);
        await queryRunner.query(`DROP TABLE "py_payment_accumulators"`);
    }

}
