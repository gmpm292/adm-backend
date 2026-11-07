import { ScopedAccessEnum } from '../../core/enums/scoped-access.enum';

/**
 * Categorías y productos son de toda la empresa (sin oficina): todos los
 * mandos de la empresa los ven, y cada oficina tiene sus existencias en sus
 * inventarios. Se usa salvo que la empresa configure otro alcance.
 */
export const CATALOG_SCOPES = [ScopedAccessEnum.BUSINESS];
