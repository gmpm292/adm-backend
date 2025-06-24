/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailModule1749515991026 implements MigrationInterface {
    name = 'AddEmailModule1749515991026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."email_status_enum" AS ENUM('pending', 'sent', 'failed', 'retrying')`);
        await queryRunner.query(`CREATE TYPE "public"."email_provider_enum" AS ENUM('smtp', 'gmail_oauth2', 'sendgrid', 'mailgun')`);
        await queryRunner.query(`CREATE TABLE "email" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "from" character varying NOT NULL, "to" character varying NOT NULL, "cc" character varying, "bcc" character varying, "subject" character varying NOT NULL, "body" text NOT NULL, "context" jsonb, "status" "public"."email_status_enum" NOT NULL DEFAULT 'pending', "provider" "public"."email_provider_enum" NOT NULL, "templateId" character varying, "attachments" jsonb, "error" jsonb, "sentAt" TIMESTAMP, "retryCount" integer NOT NULL DEFAULT '0', "lastRetryAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1e7ed8734ee054ef18002e29b1c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_template" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "defaultContext" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_274708db64fcce5448f2c4541c7" UNIQUE ("name"), CONSTRAINT "PK_c90815fd4ca9119f19462207710" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "email_template"`);
        await queryRunner.query(`DROP TABLE "email"`);
        await queryRunner.query(`DROP TYPE "public"."email_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."email_status_enum"`);
    }

}
