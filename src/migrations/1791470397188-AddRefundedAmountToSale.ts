import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundedAmountToSale1791470397188
  implements MigrationInterface
{
  name = 'AddRefundedAmountToSale1791470397188';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sl_sales" ADD "refundedAmount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sl_sales" DROP COLUMN "refundedAmount"`,
    );
  }
}
