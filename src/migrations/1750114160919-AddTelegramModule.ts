/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramModule1750114160919 implements MigrationInterface {
    name = 'AddTelegramModule1750114160919'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."telegram_message_messagetype_enum" AS ENUM('text', 'markdown', 'html', 'photo', 'document')`);
        await queryRunner.query(`CREATE TYPE "public"."telegram_message_status_enum" AS ENUM('pending', 'sent', 'delivered', 'failed', 'retrying')`);
        await queryRunner.query(`CREATE TABLE "telegram_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chatId" character varying, "phoneNumber" character varying, "recipients" jsonb, "message" character varying NOT NULL, "messageType" "public"."telegram_message_messagetype_enum" NOT NULL DEFAULT 'text', "attachments" jsonb, "context" jsonb, "status" "public"."telegram_message_status_enum" NOT NULL DEFAULT 'pending', "error" jsonb, "sentAt" TIMESTAMP, "retryCount" integer NOT NULL DEFAULT '0', "lastRetryAt" TIMESTAMP, "templateId" character varying, "botTokenKey" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "senderId" integer, CONSTRAINT "PK_0f48df9231add0c422fad2cd809" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."telegram_template_messagetype_enum" AS ENUM('text', 'markdown', 'html', 'photo', 'document')`);
        await queryRunner.query(`CREATE TABLE "telegram_template" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "message" character varying NOT NULL, "messageType" "public"."telegram_template_messagetype_enum" NOT NULL DEFAULT 'text', "defaultContext" jsonb, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e8b87d43b4bc7f22a8ef7f51f98" UNIQUE ("name"), CONSTRAINT "PK_36490004d426557d2ca806fe292" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "telegram_message" ADD CONSTRAINT "FK_9615fa9e6ee07500885505256a7" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "telegram_message" DROP CONSTRAINT "FK_9615fa9e6ee07500885505256a7"`);
        await queryRunner.query(`DROP TABLE "telegram_template"`);
        await queryRunner.query(`DROP TYPE "public"."telegram_template_messagetype_enum"`);
        await queryRunner.query(`DROP TABLE "telegram_message"`);
        await queryRunner.query(`DROP TYPE "public"."telegram_message_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."telegram_message_messagetype_enum"`);
    }

}
