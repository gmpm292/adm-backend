import { Module } from '@nestjs/common';
import { CategoryModule } from './category/category.module';
import { ProductModule } from './product/product.module';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryMovementModule } from './inventory-movement/inventory-movement.module';
import { UnitOfMeasureModule } from './unit-of-measure/unit-of-measure.module';

@Module({
  imports: [
    CategoryModule,
    ProductModule,
    InventoryModule,
    InventoryMovementModule,
    UnitOfMeasureModule,
  ],
  exports: [
    CategoryModule,
    ProductModule,
    InventoryModule,
    InventoryMovementModule,
  ],
})
export class InventoryGlobalModule {}
