/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUnitOfMeasure1772638221127 implements MigrationInterface {
    name = 'CreateUnitOfMeasure1772638221127'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "in_units_of_measure" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(50) NOT NULL, "symbol" character varying(10) NOT NULL, "category" character varying(50), "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "UQ_fbde455d1a3b16250522e1e9835" UNIQUE ("name"), CONSTRAINT "UQ_7ccda3fc281ba15ca31f8eef7f9" UNIQUE ("symbol"), CONSTRAINT "PK_519f80718882e5f0c86904c1f87" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "material_costs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "description" text, "costPrice" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "unitOfMeasureId" integer, "currencyId" integer, CONSTRAINT "PK_b1b6ab2cb2be4887ce3d8a08905" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "materialCostId" integer`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_233098bc949474b1f855e0a4c9d" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_48e3f5347dcc87f2cc384c237b9" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_9502c943202b5a4c2c22f127d1c" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_647a78080b0e2b508b52264d97c" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_df8bd3da54c1df449be7e7d2c3b" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_093d35dd8dfbeff7402fbe8dc94" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" ADD CONSTRAINT "FK_2447c2a0cfe108e7b9611542cbe" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_6d2f902d8e895b7c0ace49cadc8" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_f4e637033f8d3804d8766af518a" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_361571d6ec692554ec018844891" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_38605ab2db74599d2519642aadd" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_8d225300e2fd49d35982f455d6d" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_dcc2ecf9bc2a82afa1b9561c7c7" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_11df046e682a053ee0012b68910" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_1770d2991ab743b7dd2906d6d0b" FOREIGN KEY ("unitOfMeasureId") REFERENCES "in_units_of_measure"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_costs" ADD CONSTRAINT "FK_a0d2a590697adda8dc275315535" FOREIGN KEY ("currencyId") REFERENCES "py_currencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_1d343dd77b664cec9912cd4e776" FOREIGN KEY ("materialCostId") REFERENCES "material_costs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_1d343dd77b664cec9912cd4e776"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_a0d2a590697adda8dc275315535"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_1770d2991ab743b7dd2906d6d0b"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_11df046e682a053ee0012b68910"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_dcc2ecf9bc2a82afa1b9561c7c7"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_8d225300e2fd49d35982f455d6d"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_38605ab2db74599d2519642aadd"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_361571d6ec692554ec018844891"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_f4e637033f8d3804d8766af518a"`);
        await queryRunner.query(`ALTER TABLE "material_costs" DROP CONSTRAINT "FK_6d2f902d8e895b7c0ace49cadc8"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_2447c2a0cfe108e7b9611542cbe"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_093d35dd8dfbeff7402fbe8dc94"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_df8bd3da54c1df449be7e7d2c3b"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_647a78080b0e2b508b52264d97c"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_9502c943202b5a4c2c22f127d1c"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_48e3f5347dcc87f2cc384c237b9"`);
        await queryRunner.query(`ALTER TABLE "in_units_of_measure" DROP CONSTRAINT "FK_233098bc949474b1f855e0a4c9d"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "materialCostId"`);
        await queryRunner.query(`DROP TABLE "material_costs"`);
        await queryRunner.query(`DROP TABLE "in_units_of_measure"`);
    }

}
