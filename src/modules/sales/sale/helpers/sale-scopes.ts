import { Role } from '../../../../core/enums/role.enum';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';

/**
 * Una venta pertenece a una tienda (empresa + oficina). Con el alcance por
 * defecto del sistema un vendedor solo vería lo etiquetado con su mismo
 * departamento y equipo, y ni los productos ni los clientes lo están.
 */
export const SALE_SCOPES = [ScopedAccessEnum.BUSINESS, ScopedAccessEnum.OFFICE];

/** Movimientos de inventario que provoca una venta ya autorizada. */
export const STOCK_SCOPES = [ScopedAccessEnum.BUSINESS];

const SUPERVISING_ROLES = [
  Role.SUPER,
  Role.PRINCIPAL,
  Role.ADMIN,
  Role.MANAGER,
  Role.SUPERVISOR,
];

/** Un vendedor sin mando solo trabaja con sus propias ventas. */
export function isSellerOnly(cu?: JWTPayload): boolean {
  return !!cu && !cu.role?.some((role) => SUPERVISING_ROLES.includes(role));
}

/** Roles que pueden elegir vendedor, fechar una venta o cobrar por otro. */
export function canManageSales(cu?: JWTPayload): boolean {
  return !!cu?.role?.some((role) =>
    [Role.SUPER, Role.PRINCIPAL, Role.ADMIN].includes(role),
  );
}
