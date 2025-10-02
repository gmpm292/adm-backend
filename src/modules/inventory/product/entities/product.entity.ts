import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Category } from '../../category/entities/category.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { SaleDetail } from '../../../sales/sale-detail/entities/sale-detail.entity';
import { PaymentRule } from '../../../payroll/payment-rule/entities/payment-rule.entity';

/**
 * Description: Items sold or managed in the system.
 */
@Entity('in_products')
export class Product extends SecurityBaseEntity {
  @ManyToOne(() => Category, (category) => category.id)
  category: Category;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  unitOfMeasure: string; // e.g., grams, units

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  costPrice: number;

  @Column({ type: 'varchar', length: 3 })
  costCurrency: string; // Moneda principal (ej: 'CUP')

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown>; // e.g., { size: 'XL', color: 'Red' }

  @Column({ type: 'varchar', length: 100, nullable: true })
  warranty?: string; // Product warranty (e.g., "2 years")

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  inventories: Inventory[];

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  saleDetails: SaleDetail[];

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  basePrice: number; // Precio base en la moneda principal

  @Column({ type: 'varchar', length: 3 })
  baseCurrency: string; // Moneda principal (ej: 'CUP')

  @Column({ type: 'jsonb' })
  pricingConfig: {
    acceptedCurrencies: string[]; // Monedas aceptadas para pago (ej: ['CUP', 'USD', 'MLC'])
    fixedPrices?: Array<{
      // Precios fijos en otras monedas (opcional)
      currency: string;
      amount: number;
    }>;
    exchangeRateMargin?: number; // % margen para conversión (default 0)
    decimalPlaces?: number; // Decimales a redondear (default 2)
  };

  @Column({ type: 'jsonb', nullable: true })
  saleRules?: {
    minQuantity?: number;
    maxQuantity?: number;
    bulkDiscounts?: Array<{
      minQty: number;
      discount: number; // % descuento
      applicableCurrencies: string[]; // Monedas donde aplica
    }>;
  };

  @OneToMany(() => PaymentRule, (paymentRule) => paymentRule.product)
  paymentRules: PaymentRule[];
}
