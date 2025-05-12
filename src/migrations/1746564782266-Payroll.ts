import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payroll1746564782266 implements MigrationInterface {
  name = 'Payroll1746564782266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sl_customers" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "email" character varying(100), "phone" character varying(20), "loyaltyPoints" integer NOT NULL DEFAULT '0', "additionalInfo" jsonb, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "userId" integer, CONSTRAINT "REL_203dd3400bb358910f346a1fc9" UNIQUE ("userId"), CONSTRAINT "PK_3b4433978824663762f09d91f05" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sl_sales_paymentmethod_enum" AS ENUM('CASH', 'CARD', 'TRANSFER', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sl_sales" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "totalAmount" numeric(12,2) NOT NULL, "paymentMethod" "public"."sl_sales_paymentmethod_enum" NOT NULL DEFAULT 'CASH', "invoiceNumber" character varying(50), "paymentDetails" jsonb, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "salesUserId" integer, "customerId" integer, CONSTRAINT "PK_4a5d843ae9ad38778c5d8cf1c1a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sl_sale_details" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "quantity" numeric(10,3) NOT NULL, "unitPrice" numeric(12,2) NOT NULL, "subtotal" numeric(12,2) NOT NULL, "discountPercentage" numeric(5,2), "productSnapshot" jsonb, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "saleId" integer, "productId" integer, CONSTRAINT "PK_f870eaea7723c4edd8e910177ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."py_payment_rules_paymenttype_enum" AS ENUM('PRICE_RANGE', 'SALE_QUANTITY', 'FIXED_AMOUNT', 'PERCENTAGE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."py_payment_rules_workertype_enum" AS ENUM('AGENT', 'PUBLICIST', 'ECONOMIC', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_payment_rules" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "paymentType" "public"."py_payment_rules_paymenttype_enum" NOT NULL, "name" character varying(100) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "workerType" "public"."py_payment_rules_workertype_enum", "conditions" jsonb NOT NULL, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "PK_ec3f763a07f3f86e5f998782c32" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_workers" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "role" text NOT NULL DEFAULT 'AGENT', "workerType" character varying(20) NOT NULL, "baseSalary" numeric(12,2) NOT NULL DEFAULT '0', "customPaymentSettings" jsonb, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "userId" integer, "paymentRuleId" integer, CONSTRAINT "REL_22556e098205d6ad9934416e02" UNIQUE ("userId"), CONSTRAINT "PK_8f1c3f095d33cf4949859afe388" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_payroll_periods" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "startDate" date NOT NULL, "endDate" date NOT NULL, "isClosed" boolean NOT NULL DEFAULT false, "name" character varying(50) NOT NULL, "description" text, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "PK_6998309acf5e84b0bd5153e00e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."py_worker_payments_paymentmethod_enum" AS ENUM('CASH', 'BANK_TRANSFER', 'CHECK', 'MOBILE_PAYMENT', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."py_worker_payments_paymentconcept_enum" AS ENUM('SALARY', 'COMMISSION', 'BONUS', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_worker_payments" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "paidDate" TIMESTAMP, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "exchangeRate" numeric(12,6), "paymentMethod" "public"."py_worker_payments_paymentmethod_enum" NOT NULL, "paymentConcept" "public"."py_worker_payments_paymentconcept_enum" NOT NULL, "breakdown" jsonb, "notes" text, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "workerId" integer, "payrollPeriodId" integer, CONSTRAINT "PK_7daa803f2c990fcdc7ff34b4bfe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_work_schedules" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "startDate" date NOT NULL, "endDate" date NOT NULL, "workingDays" jsonb NOT NULL, "notes" text, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "PK_54fd4f1432b9bc298d1354f0b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "py_currencies" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying(3) NOT NULL, "name" character varying(50) NOT NULL, "symbol" character varying(10) NOT NULL, "exchangeRateToCUP" numeric(10,6) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "metadata" jsonb, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "UQ_4cdf91f63fd0cbdacca3ab0e3c1" UNIQUE ("code"), CONSTRAINT "PK_bfe76a78607ef0d2dbf7955bb41" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_63b3ce9bcaf6d3e44157d24f1b5" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_a83c817c5c81360e014e8aa6da8" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_9f4500f76177f0ec883a2753d84" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_64d25df05d17fd33b930eb13f38" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_b8ab28b7c3a74b23798ef494751" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_157b4131bdccc4ef87f2780187a" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_cb1922a5081ec718f7fc52a4663" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" ADD CONSTRAINT "FK_203dd3400bb358910f346a1fc91" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_32cbb8199661de2602317a9c542" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_4ff1a8922521f012c64a625b446" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_be083e59ac2e21a50276c0b4335" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_8a6195a37a659ffabf33a49b35d" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_6a6703ca855db42dda2c6663c27" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_4eb10a2b9eb5695dbb791e81277" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_18a65638d65b57785a14a88e2b0" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_67c197262b440545fccab719465" FOREIGN KEY ("salesUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_284a8b13fe17064babafc1e126c" FOREIGN KEY ("customerId") REFERENCES "sl_customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_734982d7b8290386c3c8259e52b" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_35b91c75bc70740c67600273e91" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_f6b6728c1b2142088ee986b2872" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_e1d0ff729f1cef3efaedebff10b" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_7ad7e25a8c5d503331181bae841" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_1d3a04f5f59a6f9ba7f1c92f71c" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_b5d3e51cb6a4838376aac023a20" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_976a221a3d16825d5a4daa8cc8a" FOREIGN KEY ("saleId") REFERENCES "sl_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" ADD CONSTRAINT "FK_e14f59d94466026b9ac944037ad" FOREIGN KEY ("productId") REFERENCES "in_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_3a4c36b4ce0f57979404ff98b00" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_4cd9330f2927c9a0545412b0ca0" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_eb96fe631691981f836968b98ba" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_bbcb649bed8a9b52c3563b34e7a" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_7748985cb9ec8e2dcffe4967767" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_b7f1782f855f185a1eed61665a6" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" ADD CONSTRAINT "FK_831faf8e3c0d0d5496a62ea9f31" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_6cfe02be79415b8df4e24a63e8f" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_5a5fcfd47203031a490c9508d55" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_f5bc0dac149cec411232c57ee87" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_82a6c1f6dee1be06b1c095cee33" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_7907de7ec45e25680df12fb6f60" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_5e9fde64adcdc61f0f55753d1b9" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_f92a86b579acec327fdbd1ff746" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_22556e098205d6ad9934416e023" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" ADD CONSTRAINT "FK_144c3adcfcd81bf010132ebb62e" FOREIGN KEY ("paymentRuleId") REFERENCES "py_payment_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_e44bd5b135efe3db0304e4fd670" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_9f206cf1315332f880f8406056f" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_4cffa7a32c0e6888e9b4e0c8144" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_1284cb177f6eb1dcedaa8f7c4db" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_ed1bba26712542dcdc6246ddc3e" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_a3f22c8bf3d75ab5292b21e07a0" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" ADD CONSTRAINT "FK_5ac8872131fe122fda4126d14a6" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_f78ceb88e3d7d819157f3ab2c32" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_34e42d147ccc0a281ffca32e4a6" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_ddc1478c1ee289d36050dc9c078" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_f00a4a44a1d663b7986e7afe5d3" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_b265562da5e930ba4a57f11f2d0" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_826a27aad282504731976aaf32e" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_eda5de861e12e50890760ada85c" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_26b52b0788e16a9365c0f261724" FOREIGN KEY ("workerId") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" ADD CONSTRAINT "FK_1c356d3a778774759ee73a4f567" FOREIGN KEY ("payrollPeriodId") REFERENCES "py_payroll_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_ebc2cfc06569399449a219cbf72" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_b0649c8966e6bbf64b93fe3da37" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_6637bc67061d9673c669245e9ff" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_8f08a842463b0b1fd76c6c257ad" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_dc401617fe6792bd4033811011a" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_dba7898c1650e44440184d816f9" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" ADD CONSTRAINT "FK_13803a21001b4eb09e923f0a753" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_1df4e0d0ec48b8f2051876bb7f8" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_a4146aa76c4a73b23671002e393" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_e168f71ca02a84fcc04cb47b3f1" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_520ceca654b0204c510105d2c6c" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_a2cd1fff6b2491107852f53e1ad" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_b0cce785dd8155f36a246eb4eab" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" ADD CONSTRAINT "FK_8f3d75099a005ce8515cc078e6b" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_8f3d75099a005ce8515cc078e6b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_b0cce785dd8155f36a246eb4eab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_a2cd1fff6b2491107852f53e1ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_520ceca654b0204c510105d2c6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_e168f71ca02a84fcc04cb47b3f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_a4146aa76c4a73b23671002e393"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_currencies" DROP CONSTRAINT "FK_1df4e0d0ec48b8f2051876bb7f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_13803a21001b4eb09e923f0a753"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_dba7898c1650e44440184d816f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_dc401617fe6792bd4033811011a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_8f08a842463b0b1fd76c6c257ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_6637bc67061d9673c669245e9ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_b0649c8966e6bbf64b93fe3da37"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_work_schedules" DROP CONSTRAINT "FK_ebc2cfc06569399449a219cbf72"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_1c356d3a778774759ee73a4f567"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_26b52b0788e16a9365c0f261724"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_eda5de861e12e50890760ada85c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_826a27aad282504731976aaf32e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_b265562da5e930ba4a57f11f2d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_f00a4a44a1d663b7986e7afe5d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_ddc1478c1ee289d36050dc9c078"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_34e42d147ccc0a281ffca32e4a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_worker_payments" DROP CONSTRAINT "FK_f78ceb88e3d7d819157f3ab2c32"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_5ac8872131fe122fda4126d14a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_a3f22c8bf3d75ab5292b21e07a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_ed1bba26712542dcdc6246ddc3e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_1284cb177f6eb1dcedaa8f7c4db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_4cffa7a32c0e6888e9b4e0c8144"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_9f206cf1315332f880f8406056f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payroll_periods" DROP CONSTRAINT "FK_e44bd5b135efe3db0304e4fd670"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_144c3adcfcd81bf010132ebb62e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_22556e098205d6ad9934416e023"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_f92a86b579acec327fdbd1ff746"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_5e9fde64adcdc61f0f55753d1b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_7907de7ec45e25680df12fb6f60"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_82a6c1f6dee1be06b1c095cee33"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_f5bc0dac149cec411232c57ee87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_5a5fcfd47203031a490c9508d55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_workers" DROP CONSTRAINT "FK_6cfe02be79415b8df4e24a63e8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_831faf8e3c0d0d5496a62ea9f31"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_b7f1782f855f185a1eed61665a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_7748985cb9ec8e2dcffe4967767"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_bbcb649bed8a9b52c3563b34e7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_eb96fe631691981f836968b98ba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_4cd9330f2927c9a0545412b0ca0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "py_payment_rules" DROP CONSTRAINT "FK_3a4c36b4ce0f57979404ff98b00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_e14f59d94466026b9ac944037ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_976a221a3d16825d5a4daa8cc8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_b5d3e51cb6a4838376aac023a20"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_1d3a04f5f59a6f9ba7f1c92f71c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_7ad7e25a8c5d503331181bae841"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_e1d0ff729f1cef3efaedebff10b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_f6b6728c1b2142088ee986b2872"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_35b91c75bc70740c67600273e91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sale_details" DROP CONSTRAINT "FK_734982d7b8290386c3c8259e52b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_284a8b13fe17064babafc1e126c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_67c197262b440545fccab719465"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_18a65638d65b57785a14a88e2b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_4eb10a2b9eb5695dbb791e81277"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_6a6703ca855db42dda2c6663c27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_8a6195a37a659ffabf33a49b35d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_be083e59ac2e21a50276c0b4335"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_4ff1a8922521f012c64a625b446"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_32cbb8199661de2602317a9c542"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_203dd3400bb358910f346a1fc91"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_cb1922a5081ec718f7fc52a4663"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_157b4131bdccc4ef87f2780187a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_b8ab28b7c3a74b23798ef494751"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_64d25df05d17fd33b930eb13f38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_9f4500f76177f0ec883a2753d84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_a83c817c5c81360e014e8aa6da8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sl_customers" DROP CONSTRAINT "FK_63b3ce9bcaf6d3e44157d24f1b5"`,
    );
    await queryRunner.query(`DROP TABLE "py_currencies"`);
    await queryRunner.query(`DROP TABLE "py_work_schedules"`);
    await queryRunner.query(`DROP TABLE "py_worker_payments"`);
    await queryRunner.query(
      `DROP TYPE "public"."py_worker_payments_paymentconcept_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."py_worker_payments_paymentmethod_enum"`,
    );
    await queryRunner.query(`DROP TABLE "py_payroll_periods"`);
    await queryRunner.query(`DROP TABLE "py_workers"`);
    await queryRunner.query(`DROP TABLE "py_payment_rules"`);
    await queryRunner.query(
      `DROP TYPE "public"."py_payment_rules_workertype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."py_payment_rules_paymenttype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "sl_sale_details"`);
    await queryRunner.query(`DROP TABLE "sl_sales"`);
    await queryRunner.query(`DROP TYPE "public"."sl_sales_paymentmethod_enum"`);
    await queryRunner.query(`DROP TABLE "sl_customers"`);
  }
}
