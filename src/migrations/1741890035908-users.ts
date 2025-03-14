/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class Users1741890035908 implements MigrationInterface {
    name = 'Users1741890035908'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users_confirmationTokens" ADD CONSTRAINT "FK_6f3cc93189ed547fd83c5a4b747" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users_confirmationTokens" DROP CONSTRAINT "FK_6f3cc93189ed547fd83c5a4b747"`);
    }

}
