import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeNullableOfPayments1759426360976 implements MigrationInterface {
    name = 'ChangeNullableOfPayments1759426360976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" ALTER COLUMN "payments" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sl_sales" ALTER COLUMN "payments" SET NOT NULL`);
    }

}
