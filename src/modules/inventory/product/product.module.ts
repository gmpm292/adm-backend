import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductResolver } from './resolvers/product.resolver';
import { ProductService } from './services/product.service';
import { Product } from './entities/product.entity';
import { Category } from '../category/entities/category.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { User } from '../../users/entities/user.entity';
import { CategoryModule } from '../category/category.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CurrencyModule } from '../../payroll/currency/currency.module';
import { InventoryMovementModule } from '../inventory-movement/inventory-movement.module';
import { UnitOfMeasureModule } from '../unit-of-measure/unit-of-measure.module';
import { MaterialCostModule } from '../../payroll/material-cost/material-cost.module';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, Inventory, User]),
    forwardRef(() => CategoryModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => InventoryMovementModule),
    forwardRef(() => CurrencyModule),
    UnitOfMeasureModule,
    forwardRef(() => MaterialCostModule),
  ],
  providers: [ProductResolver, ProductService],
  exports: [ProductResolver, ProductService],
})
export class ProductModule {}
