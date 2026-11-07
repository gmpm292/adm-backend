import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorías y productos pasan a ser de toda la empresa: se les quita la
 * oficina, el departamento y el equipo. Las existencias siguen siendo de cada
 * oficina (los inventarios). Con oficina, un producto solo podía tener
 * inventario en ella y no se podía trasladar a otra.
 *
 * `down` no hace nada: no se sabe a qué oficina pertenecía cada uno.
 */
export class CatalogPerBusiness1794073308066 implements MigrationInterface {
  name = 'CatalogPerBusiness1794073308066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['in_categories', 'in_products']) {
      await queryRunner.query(
        `UPDATE "${table}" SET "officeId" = NULL, "departmentId" = NULL, "teamId" = NULL
         WHERE "officeId" IS NOT NULL OR "departmentId" IS NOT NULL OR "teamId" IS NOT NULL`,
      );
    }
  }

  public async down(): Promise<void> {
    // Irreversible: la oficina anterior de cada registro no se guarda.
  }
}
