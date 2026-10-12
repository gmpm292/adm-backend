import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { Office } from '../../../company/office/entities/co_office.entity';
import { Product } from '../../../inventory/product/entities/product.entity';
import { ProductService } from '../../../inventory/product/services/product.service';
import { Currency } from '../../../payroll/currency/entities/currency.entity';
import { Worker } from '../../../payroll/worker/entities/worker.entity';
import { isSellerOnly } from '../helpers/sale-scopes';

type CatalogOffice = {
  id: number;
  name: string;
  businessId: number;
  businessName?: string;
};

export type SaleCatalog = {
  office: CatalogOffice | null;
  offices: CatalogOffice[];
  currencies: Array<{
    code: string;
    name: string;
    symbol: string;
    exchangeRateToCUP: number;
  }>;
  defaultCurrency: string | null;
  categories: Array<{ id: number; name: string }>;
  products: Array<{
    id: number;
    name: string;
    categoryId: number | null;
    categoryName: string | null;
    unit: string | null;
    stock: number;
    baseCurrency: string;
    prices: Array<{ currency: string; unitPrice: number }>;
    minQuantity: number | null;
    maxQuantity: number | null;
  }>;
  workers: Array<{
    id: number;
    name: string;
    workerType: string;
    userId: number | null;
  }>;
  currentWorkerId: number | null;
  canChooseSeller: boolean;
};

/**
 * Todo lo que la pantalla de venta necesita de una tienda, en una consulta:
 * productos con precio y existencias, monedas y personal. Solo lectura y
 * limitado a la tienda del usuario, para que un vendedor no necesite permiso
 * sobre los catálogos de inventario y nómina.
 */
@Injectable()
export class SaleCatalogService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly productService: ProductService,
  ) {}

  /**
   * Catálogo de una tienda. Quien tiene oficina en su sesión siempre ve la
   * suya; el resto la pedida o, si no pide ninguna, la primera disponible.
   * Sin tienda devuelve el catálogo vacío con la lista de oficinas.
   */
  async getCatalog(cu: JWTPayload, officeId?: number): Promise<SaleCatalog> {
    const offices = await this.availableOffices(cu);
    const office =
      offices.find((o) => o.id === (cu.officeId ?? officeId)) ??
      (cu.officeId ? undefined : offices[0]);

    if (officeId && !cu.officeId && office?.id !== officeId) {
      throw new BadRequestError('La tienda indicada no está disponible');
    }

    const empty: SaleCatalog = {
      office: null,
      offices,
      currencies: [],
      defaultCurrency: null,
      categories: [],
      products: [],
      workers: [],
      currentWorkerId: null,
      canChooseSeller: !isSellerOnly(cu),
    };
    if (!office) return empty;

    // De la tienda: lo de su oficina o lo de la empresa sin oficina asignada.
    const inStore = <T>(): FindOptionsWhere<T>[] =>
      [
        { office: { id: office.id } },
        { business: { id: office.businessId }, office: IsNull() },
      ] as unknown as FindOptionsWhere<T>[];

    const [products, workers, activeCurrencies] = await Promise.all([
      this.manager.find(Product, {
        where: inStore<Product>(),
        relations: {
          category: true,
          unitOfMeasure: true,
          inventories: { office: true },
        },
        order: { name: 'ASC' },
      }),
      this.manager.find(Worker, {
        where: inStore<Worker>(),
        relations: { user: true },
      }),
      this.manager.find(Currency, { where: { isActive: true } }),
    ]);

    const catalogProducts: SaleCatalog['products'] = [];
    for (const product of products) {
      const { paymentOptions } = await this.productService.buildPaymentOptions(
        product,
        1,
      );
      // Sin precio en ninguna moneda activa no se puede vender.
      if (paymentOptions.length === 0) continue;

      catalogProducts.push({
        id: product.id as number,
        name: product.name,
        categoryId: product.category?.id ?? null,
        categoryName: product.category?.name ?? null,
        unit: product.unitOfMeasure?.symbol ?? null,
        // Solo el stock de la tienda: la venta reserva de sus inventarios.
        stock: (product.inventories ?? [])
          .filter((inventory) => inventory.office?.id === office.id)
          .reduce((sum, inventory) => sum + inventory.currentStock, 0),
        baseCurrency: product.baseCurrency,
        prices: paymentOptions.map((option) => ({
          currency: option.currency,
          unitPrice: option.unitPrice,
        })),
        minQuantity: product.saleRules?.minQuantity ?? null,
        maxQuantity: product.saleRules?.maxQuantity ?? null,
      });
    }

    const categories = new Map<number, string>();
    for (const product of catalogProducts) {
      if (product.categoryId) {
        categories.set(product.categoryId, product.categoryName as string);
      }
    }

    // Solo las monedas en las que se vende algo, la más usada primero. Ser
    // moneda base de un producto pesa 1000 veces más que solo aceptarla.
    const usage = new Map<string, number>();
    for (const product of catalogProducts) {
      usage.set(
        product.baseCurrency,
        (usage.get(product.baseCurrency) ?? 0) + 1000,
      );
      for (const price of product.prices) {
        usage.set(price.currency, (usage.get(price.currency) ?? 0) + 1);
      }
    }
    const currencies = activeCurrencies
      .filter((currency) => usage.has(currency.code))
      .sort((a, b) => (usage.get(b.code) ?? 0) - (usage.get(a.code) ?? 0))
      .map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        exchangeRateToCUP: Number(currency.exchangeRateToCUP),
      }));

    const catalogWorkers = workers
      .map((worker) => ({
        id: worker.id as number,
        name: this.workerName(worker),
        workerType: worker.workerType,
        userId: worker.user?.id ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...empty,
      office,
      currencies,
      defaultCurrency: currencies[0]?.code ?? null,
      categories: [...categories.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      products: catalogProducts,
      workers: catalogWorkers,
      currentWorkerId:
        catalogWorkers.find((worker) => worker.userId === cu.sub)?.id ?? null,
    };
  }

  /**
   * Tiendas en las que el usuario puede vender: la de su sesión si tiene
   * oficina; si no, todas (SUPER) o las de su empresa.
   */
  private async availableOffices(cu: JWTPayload): Promise<CatalogOffice[]> {
    const where: FindOptionsWhere<Office> = cu.officeId
      ? { id: cu.officeId }
      : cu.role?.includes(Role.SUPER)
        ? {}
        : { business: { id: cu.businessId ?? -1 } };

    const offices = await this.manager.find(Office, {
      where,
      relations: { business: true },
      order: { name: 'ASC' },
    });

    return offices
      .filter((office) => office.business?.id)
      .map((office) => ({
        id: office.id as number,
        name: office.name,
        businessId: office.business.id as number,
        businessName: office.business.name,
      }));
  }

  /** Nombre del usuario vinculado, el del trabajador o «Trabajador #id». */
  private workerName(worker: Worker): string {
    const user = worker.user;
    const fromUser =
      user?.fullName || [user?.name, user?.lastName].filter(Boolean).join(' ');
    const fromTemp = [worker.tempFirstName, worker.tempLastName]
      .filter(Boolean)
      .join(' ');
    return fromUser || fromTemp || `Trabajador #${worker.id}`;
  }
}
