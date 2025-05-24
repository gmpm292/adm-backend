import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInTeamType1747860141790 implements MigrationInterface {
    name = 'ChangesInTeamType1747860141790'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."co_teams_teamtype_enum" RENAME TO "co_teams_teamtype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."co_teams_teamtype_enum" AS ENUM('FIELDWORK', 'OPERATIONS', 'DELIVERIES', 'SALES', 'ADVERTISING_MARKETING')`);
        await queryRunner.query(`ALTER TABLE "co_teams" ALTER COLUMN "teamType" TYPE "public"."co_teams_teamtype_enum" USING "teamType"::"text"::"public"."co_teams_teamtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."co_teams_teamtype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."co_teams_teamtype_enum_old" AS ENUM('GROUP_A', 'GROUP_B')`);
        await queryRunner.query(`ALTER TABLE "co_teams" ALTER COLUMN "teamType" TYPE "public"."co_teams_teamtype_enum_old" USING "teamType"::"text"::"public"."co_teams_teamtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."co_teams_teamtype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."co_teams_teamtype_enum_old" RENAME TO "co_teams_teamtype_enum"`);
    }

}
