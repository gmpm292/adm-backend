import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInSomeEntities1747858525940 implements MigrationInterface {
    name = 'ChangesInSomeEntities1747858525940'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_67c197262b440545fccab719465"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "paymentMethod"`);
        await queryRunner.query(`DROP TYPE "public"."sl_sales_paymentmethod_enum"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "paymentDetails"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "salesUserId"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "salePrice"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "unitPrice"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "subtotal"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "discountPercentage"`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD "name" character varying`);
        await queryRunner.query(`ALTER TABLE "co_teams" ADD "description" character varying`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "payments" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "totalAmountCurrency" character varying(3)`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "effectiveDate" TIME`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "salesWorkerId" integer`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD "reservationId" character varying(36)`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD "isReservation" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD "referenceId" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "costCurrency" character varying(3) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "basePrice" numeric(12,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "baseCurrency" character varying(3) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "pricingConfig" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "saleRules" jsonb`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "productPaymentOptions" jsonb`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "reservationId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ALTER COLUMN "totalAmount" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_d9702dea6cd7c4bb406d76ce81e" FOREIGN KEY ("salesWorkerId") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP CONSTRAINT "FK_d9702dea6cd7c4bb406d76ce81e"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ALTER COLUMN "totalAmount" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "reservationId"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" DROP COLUMN "productPaymentOptions"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "saleRules"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "pricingConfig"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "baseCurrency"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "basePrice"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "costCurrency"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP COLUMN "referenceId"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP COLUMN "isReservation"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP COLUMN "reservationId"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "salesWorkerId"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "effectiveDate"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "totalAmountCurrency"`);
        await queryRunner.query(`ALTER TABLE "sl_sales" DROP COLUMN "payments"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "co_teams" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "discountPercentage" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "subtotal" numeric(12,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details" ADD "unitPrice" numeric(12,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "salePrice" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "salesUserId" integer`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "paymentDetails" jsonb`);
        await queryRunner.query(`CREATE TYPE "public"."sl_sales_paymentmethod_enum" AS ENUM('CASH', 'CARD', 'TRANSFER', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD "paymentMethod" "public"."sl_sales_paymentmethod_enum" NOT NULL DEFAULT 'CASH'`);
        await queryRunner.query(`ALTER TABLE "sl_sales" ADD CONSTRAINT "FK_67c197262b440545fccab719465" FOREIGN KEY ("salesUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
