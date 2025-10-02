import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSchedulerEntity1756825762293 implements MigrationInterface {
    name = 'AddSchedulerEntity1756825762293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "scheduled_task" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying NOT NULL, "handlerType" character varying NOT NULL, "cronExpression" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastRun" TIMESTAMP, "nextRun" TIMESTAMP, CONSTRAINT "PK_d690af24e57e30594c1948af1e6" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "scheduled_task"`);
    }

}
