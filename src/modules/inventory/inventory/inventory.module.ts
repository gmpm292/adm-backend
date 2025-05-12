import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryResolver } from './resolvers/inventory.resolver';
import { InventoryService } from './services/inventory.service';
import { Inventory } from './entities/inventory.entity';
import { Product } from '../product/entities/product.entity';
import { InventoryMovement } from '../inventory-movement/entities/inventory-movement.entity';

import { User } from '../../users/entities/user.entity';
import { ProductModule } from '../product/product.module';
import { InventoryMovementModule } from '../inventory-movement/inventory-movement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inventory, Product, InventoryMovement, User]),
    forwardRef(() => ProductModule),
    forwardRef(() => InventoryMovementModule),
  ],
  providers: [InventoryResolver, InventoryService],
  exports: [InventoryResolver, InventoryService],
})
export class InventoryModule {}
