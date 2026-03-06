/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInAttendance1770412910110 implements MigrationInterface {
    name = 'ChangesInAttendance1770412910110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_95e118a61b11ad3c1e69ee3495e"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" RENAME COLUMN "worker_id" TO "workerId"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_b9ebf061658116a7d93bd73c4be" FOREIGN KEY ("workerId") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_b9ebf061658116a7d93bd73c4be"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" RENAME COLUMN "workerId" TO "worker_id"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_95e118a61b11ad3c1e69ee3495e" FOREIGN KEY ("worker_id") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
