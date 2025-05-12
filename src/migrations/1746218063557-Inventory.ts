/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class Inventory1746218063557 implements MigrationInterface {
    name = 'Inventory1746218063557'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "in_categories" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "description" text, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, CONSTRAINT "PK_dbde68ef19a67f5520d730f89b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "in_inventory_movements" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "type" character varying(20) NOT NULL, "quantity" integer NOT NULL, "reason" character varying(50) NOT NULL, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "inventoryId" integer, "userId" integer, CONSTRAINT "PK_203a1d9e6431df1dccc6fcb1c4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "in_inventories" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "currentStock" integer NOT NULL, "minStock" integer, "location" character varying(100), "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "productId" integer, CONSTRAINT "PK_2418ac523531f31dabbb27fb6ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "in_products" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "unitOfMeasure" character varying(50) NOT NULL, "costPrice" numeric(10,2) NOT NULL, "salePrice" numeric(10,2) NOT NULL, "attributes" jsonb, "warranty" character varying(100), "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "categoryId" integer, CONSTRAINT "PK_1c23f3af4a707b77854598f744d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_2b6b9a38cbf14ba9cbd72eb4f2e" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_08d238269954c7e20fc2e148029" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_e5ba31cf43df132028c6e141ff9" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_f7391b8a1e454d3b197ca676fcb" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_b241540ce3f6a2386c52510adbf" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_81d7d925660528dc8a6b7394080" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_categories" ADD CONSTRAINT "FK_cc62e3c25782cd5a6d2c0e8af1b" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_ffa9c0269e0cfaafdfdea651a1f" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_cffe2e2009b84fd57c59800f5fa" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_16163a3f4c38888e89c94648c61" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_e001749f5bc807902ee4fbddeb1" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_82238cdf9375086ffb3c6b274c7" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_84bfededf0c8dae6ce66f456d7b" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_093891a6f688355c90c984f10a3" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_e0e855fed3a7f75e88bd828cb35" FOREIGN KEY ("inventoryId") REFERENCES "in_inventories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" ADD CONSTRAINT "FK_e738e8df6015abcee2f624db1bf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_348c6511ad9d7add4ebefa82d0d" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_54a727428912decf76c62352dcd" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_973bbe25bc8754a069f3ecb55c0" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_3b3b676109d5fb91b479e973ef8" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_dfb907a1e0455842bd63da2f228" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_c5a861b226f6301441642abbcfa" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_2e7587f69d92ff0afff5f7037e2" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_inventories" ADD CONSTRAINT "FK_fd133e1bb3dc4a114c808ba4b38" FOREIGN KEY ("productId") REFERENCES "in_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_f7f321764fc9dc5d202608e2717" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_e1cd6c449c4ba3c17dfaeb240f8" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_41d7897f971c1808e80b3e11b90" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_cd49e7248a197e6a815c7014461" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_e20a93c23fa544cfa1701663d63" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_b0543c62d108897f09e4017fe50" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_f34c179df0b0bb98afc00b01f68" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_d405bc25af77b971f5a859d1938" FOREIGN KEY ("categoryId") REFERENCES "in_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_d405bc25af77b971f5a859d1938"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_f34c179df0b0bb98afc00b01f68"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_b0543c62d108897f09e4017fe50"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_e20a93c23fa544cfa1701663d63"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_cd49e7248a197e6a815c7014461"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_41d7897f971c1808e80b3e11b90"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_e1cd6c449c4ba3c17dfaeb240f8"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_f7f321764fc9dc5d202608e2717"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_fd133e1bb3dc4a114c808ba4b38"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_2e7587f69d92ff0afff5f7037e2"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_c5a861b226f6301441642abbcfa"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_dfb907a1e0455842bd63da2f228"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_3b3b676109d5fb91b479e973ef8"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_973bbe25bc8754a069f3ecb55c0"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_54a727428912decf76c62352dcd"`);
        await queryRunner.query(`ALTER TABLE "in_inventories" DROP CONSTRAINT "FK_348c6511ad9d7add4ebefa82d0d"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_e738e8df6015abcee2f624db1bf"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_e0e855fed3a7f75e88bd828cb35"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_093891a6f688355c90c984f10a3"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_84bfededf0c8dae6ce66f456d7b"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_82238cdf9375086ffb3c6b274c7"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_e001749f5bc807902ee4fbddeb1"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_16163a3f4c38888e89c94648c61"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_cffe2e2009b84fd57c59800f5fa"`);
        await queryRunner.query(`ALTER TABLE "in_inventory_movements" DROP CONSTRAINT "FK_ffa9c0269e0cfaafdfdea651a1f"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_cc62e3c25782cd5a6d2c0e8af1b"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_81d7d925660528dc8a6b7394080"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_b241540ce3f6a2386c52510adbf"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_f7391b8a1e454d3b197ca676fcb"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_e5ba31cf43df132028c6e141ff9"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_08d238269954c7e20fc2e148029"`);
        await queryRunner.query(`ALTER TABLE "in_categories" DROP CONSTRAINT "FK_2b6b9a38cbf14ba9cbd72eb4f2e"`);
        await queryRunner.query(`DROP TABLE "in_products"`);
        await queryRunner.query(`DROP TABLE "in_inventories"`);
        await queryRunner.query(`DROP TABLE "in_inventory_movements"`);
        await queryRunner.query(`DROP TABLE "in_categories"`);
    }

}
