import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesEmailModule1749590597930 implements MigrationInterface {
    name = 'ChangesEmailModule1749590597930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email" ALTER COLUMN "subject" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email" ALTER COLUMN "subject" SET NOT NULL`);
    }

}
