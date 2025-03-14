/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1741915230363 implements MigrationInterface {
    name = 'Init1741915230363'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "RoleGuardEntity" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "queryOrEndPointURL" character varying NOT NULL, "type" character varying NOT NULL DEFAULT '', "description" character varying NOT NULL DEFAULT '', "roles" "public"."RoleGuardEntity_roles_enum" array, "entityStatus" "public"."RoleGuardEntity_entitystatus_enum" DEFAULT '1', CONSTRAINT "UQ_c684f057fde9a130a86b3e87e44" UNIQUE ("queryOrEndPointURL"), CONSTRAINT "PK_b1343c076dd868174e06307ce77" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users_confirmationTokens" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tokenValue" character varying, "expirationDate" TIMESTAMP NOT NULL, "used" boolean NOT NULL, "userId" integer, CONSTRAINT "PK_2c57d5dbd1b946533c692bfc9f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tipo" character varying NOT NULL, "titulo" character varying NOT NULL, "message" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "sentAt" TIMESTAMP, "metadata" jsonb, "createdById" integer, "sentById" integer, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notifications-log" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "read" boolean NOT NULL, "erased" boolean NOT NULL, "notificationId" integer, "userId" integer, CONSTRAINT "PK_9b1c4999eff550811d1eab81f8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "lastName" character varying, "fullName" character varying, "mobile" character varying NOT NULL, "password" character varying, "refreshToken" character varying, "role" text array NOT NULL DEFAULT '{}', "twoFASecret" character varying, "isTwoFactorEnabled" boolean NOT NULL DEFAULT false, "isTwoFactorConfigured" boolean NOT NULL DEFAULT false, "type" character varying NOT NULL DEFAULT 'User', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_d376a9f93bba651f32a2c03a7d3" UNIQUE ("mobile"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d376a9f93bba651f32a2c03a7d" ON "users" ("mobile") `);
        await queryRunner.query(`CREATE INDEX "IDX_94e2000b5f7ee1f9c491f0f8a8" ON "users" ("type") `);
        await queryRunner.query(`CREATE TABLE "logs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "level" character varying NOT NULL, "message" character varying NOT NULL, "meta" json NOT NULL DEFAULT '{}', "userId" integer, "intServErrorId" character varying, CONSTRAINT "PK_fb1b805f2f7795de79fa69340ba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "category" "public"."config_category_enum" NOT NULL DEFAULT 'GENERAL', "group" character varying NOT NULL, "description" character varying, "values" jsonb, "configVisibility" "public"."config_configvisibility_enum" NOT NULL DEFAULT '1', "configStatus" "public"."config_configstatus_enum" DEFAULT '1', CONSTRAINT "UQ_fb63863dfa23f831c1a70a359b3" UNIQUE ("group"), CONSTRAINT "PK_d0ee79a681413d50b0a4f98cf7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users_confirmationTokens" ADD CONSTRAINT "FK_6f3cc93189ed547fd83c5a4b747" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_fcce8c50a375466676d82dcbadd" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_d2bbc6c49c859d005c86a33f242" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications-log" ADD CONSTRAINT "FK_547748757c8edc9d80acbdcf49a" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications-log" ADD CONSTRAINT "FK_3b1e1696506e29905b373a08e87" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications-log" DROP CONSTRAINT "FK_3b1e1696506e29905b373a08e87"`);
        await queryRunner.query(`ALTER TABLE "notifications-log" DROP CONSTRAINT "FK_547748757c8edc9d80acbdcf49a"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_d2bbc6c49c859d005c86a33f242"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_fcce8c50a375466676d82dcbadd"`);
        await queryRunner.query(`ALTER TABLE "users_confirmationTokens" DROP CONSTRAINT "FK_6f3cc93189ed547fd83c5a4b747"`);
        await queryRunner.query(`DROP TABLE "config"`);
        await queryRunner.query(`DROP TABLE "logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e2000b5f7ee1f9c491f0f8a8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d376a9f93bba651f32a2c03a7d"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "notifications-log"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TABLE "users_confirmationTokens"`);
        await queryRunner.query(`DROP TABLE "RoleGuardEntity"`);
    }

}
