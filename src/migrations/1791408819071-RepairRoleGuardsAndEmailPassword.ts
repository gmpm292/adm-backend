import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Permisos: la pantalla anterior guardaba `roles` vacíos (o solo USER) al
 *   «desactivar» o «activar» una operación, y así nadie podía usarla, ni el
 *   superadministrador. Esas filas vuelven a los roles del código (`NULL`).
 * - Correo SMTP: la clave se llamaba `EMAIL_PASSWOR` y el envío lee
 *   `EMAIL_PASSWORD`; se renombra conservando el valor.
 */
export class RepairRoleGuardsAndEmailPassword1791408819071
  implements MigrationInterface
{
  name = 'RepairRoleGuardsAndEmailPassword1791408819071';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "RoleGuardEntity" SET "roles" = NULL WHERE "roles" IS NOT NULL AND NOT ('SUPER' = ANY("roles"))`,
    );
    await queryRunner.query(
      `UPDATE "config" SET "values" = ("values" - 'EMAIL_PASSWOR') || jsonb_build_object('EMAIL_PASSWORD', "values"->'EMAIL_PASSWOR') WHERE "values" ? 'EMAIL_PASSWOR'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "config" SET "values" = ("values" - 'EMAIL_PASSWORD') || jsonb_build_object('EMAIL_PASSWOR', "values"->'EMAIL_PASSWORD') WHERE "values" ? 'EMAIL_PASSWORD'`,
    );
  }
}
