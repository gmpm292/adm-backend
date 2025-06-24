import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesEmailModule1749591449976 implements MigrationInterface {
    name = 'ChangesEmailModule1749591449976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email" ALTER COLUMN "body" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email" ALTER COLUMN "body" SET NOT NULL`);
    }

}
