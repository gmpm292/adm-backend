/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttendanceModifyWorker1756313479900 implements MigrationInterface {
    name = 'AddAttendanceModifyWorker1756313479900'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."py_attendances_status_enum" AS ENUM('present', 'absent', 'late', 'early_departure', 'vacation', 'sick_leave')`);
        await queryRunner.query(`CREATE TABLE "py_attendances" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "attendanceDate" date NOT NULL, "checkInTime" TIME(0), "checkOutTime" TIME(0), "status" "public"."py_attendances_status_enum" NOT NULL DEFAULT 'absent', "hoursWorked" numeric(5,2) NOT NULL DEFAULT '0', "counts_for_profit_sharing" boolean NOT NULL DEFAULT true, "isPaid" boolean NOT NULL DEFAULT false, "notes" text, "isHoliday" boolean NOT NULL DEFAULT false, "createdById" integer, "deletedById" integer, "updatedById" integer, "businessId" integer, "officeId" integer, "departmentId" integer, "teamId" integer, "worker_id" integer, "work_schedule_id" integer, CONSTRAINT "PK_7e92dfbd47724b617fed419e271" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "tempFirstName" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "tempLastName" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "tempEmail" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "tempPhone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "tempRole" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_a16a134e138b8e6f7d57b920583" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_a9368f45f32366a4abbcd85bda4" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_f15193854c8a549caf454349b7e" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_41879ae7234a7777fe9f165d628" FOREIGN KEY ("businessId") REFERENCES "co_businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_b28a30c8d58877027acf13fd6f5" FOREIGN KEY ("officeId") REFERENCES "co_offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_24f9a5e0435eb2b0996613073d0" FOREIGN KEY ("departmentId") REFERENCES "co_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_798780d89e17dd2088607d835fb" FOREIGN KEY ("teamId") REFERENCES "co_teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_95e118a61b11ad3c1e69ee3495e" FOREIGN KEY ("worker_id") REFERENCES "py_workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "py_attendances" ADD CONSTRAINT "FK_f241a73cb7802b20b0344d15a2f" FOREIGN KEY ("work_schedule_id") REFERENCES "py_work_schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_f241a73cb7802b20b0344d15a2f"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_95e118a61b11ad3c1e69ee3495e"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_798780d89e17dd2088607d835fb"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_24f9a5e0435eb2b0996613073d0"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_b28a30c8d58877027acf13fd6f5"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_41879ae7234a7777fe9f165d628"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_f15193854c8a549caf454349b7e"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_a9368f45f32366a4abbcd85bda4"`);
        await queryRunner.query(`ALTER TABLE "py_attendances" DROP CONSTRAINT "FK_a16a134e138b8e6f7d57b920583"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "tempRole"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "tempPhone"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "tempEmail"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "tempLastName"`);
        await queryRunner.query(`ALTER TABLE "py_workers" DROP COLUMN "tempFirstName"`);
        await queryRunner.query(`ALTER TABLE "py_workers" ADD "role" text NOT NULL DEFAULT 'AGENT'`);
        await queryRunner.query(`DROP TABLE "py_attendances"`);
        await queryRunner.query(`DROP TYPE "public"."py_attendances_status_enum"`);
    }

}
