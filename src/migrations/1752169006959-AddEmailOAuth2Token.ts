/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailOAuth2Token1752169006959 implements MigrationInterface {
    name = 'AddEmailOAuth2Token1752169006959'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_o_auth2_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(500) NOT NULL, "encryptedRefreshToken" text NOT NULL, "accessToken" character varying(255), "accessTokenExpiry" TIMESTAMP, "email" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_780d5b6d69a849d9f1914ca513b" UNIQUE ("email"), CONSTRAINT "PK_1f53a7faa9a9bb84440e425ea79" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "email_o_auth2_token"`);
    }

}
