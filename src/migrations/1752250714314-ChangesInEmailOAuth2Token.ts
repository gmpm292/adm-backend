/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInEmailOAuth2Token1752250714314 implements MigrationInterface {
    name = 'ChangesInEmailOAuth2Token1752250714314'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_o_auth2_token" DROP CONSTRAINT "UQ_780d5b6d69a849d9f1914ca513b"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_o_auth2_token" ADD CONSTRAINT "UQ_780d5b6d69a849d9f1914ca513b" UNIQUE ("email")`);
    }

}
