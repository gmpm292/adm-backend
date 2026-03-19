/* eslint-disable prettier/prettier */
import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangesInProduct1773070456427 implements MigrationInterface {
    name = 'ChangesInProduct1773070456427'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "in_products" RENAME COLUMN "unitOfMeasure" TO "unitOfMeasureId"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "unitOfMeasureId"`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "unitOfMeasureId" integer`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD CONSTRAINT "FK_3da9f87a91be1105bb7c3a3692b" FOREIGN KEY ("unitOfMeasureId") REFERENCES "in_units_of_measure"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "in_products" DROP CONSTRAINT "FK_3da9f87a91be1105bb7c3a3692b"`);
        await queryRunner.query(`ALTER TABLE "in_products" DROP COLUMN "unitOfMeasureId"`);
        await queryRunner.query(`ALTER TABLE "in_products" ADD "unitOfMeasureId" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "in_products" RENAME COLUMN "unitOfMeasureId" TO "unitOfMeasure"`);
    }

}
