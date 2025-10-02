/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSalesPublicists1759410152690 implements MigrationInterface {
    name = 'AddSalesPublicists1759410152690'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sl_sale_details_publicists" ("sale_details_id" integer NOT NULL, "publicist_id" integer NOT NULL, CONSTRAINT "PK_4c456e8a9b1b2a7b30182647b8b" PRIMARY KEY ("sale_details_id", "publicist_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c279e732a89db3cc46788aa0ea" ON "sl_sale_details_publicists" ("sale_details_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5015636b4e54e53730a47787f6" ON "sl_sale_details_publicists" ("publicist_id") `);
        await queryRunner.query(`ALTER TABLE "sl_sale_details_publicists" ADD CONSTRAINT "FK_c279e732a89db3cc46788aa0ea5" FOREIGN KEY ("sale_details_id") REFERENCES "sl_sale_details"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details_publicists" ADD CONSTRAINT "FK_5015636b4e54e53730a47787f65" FOREIGN KEY ("publicist_id") REFERENCES "py_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sale_details_publicists" DROP CONSTRAINT "FK_5015636b4e54e53730a47787f65"`);
        await queryRunner.query(`ALTER TABLE "sl_sale_details_publicists" DROP CONSTRAINT "FK_c279e732a89db3cc46788aa0ea5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5015636b4e54e53730a47787f6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c279e732a89db3cc46788aa0ea"`);
        await queryRunner.query(`DROP TABLE "sl_sale_details_publicists"`);
    }

}
