import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovementResolver } from './resolvers/inventory-movement.resolver';
import { InventoryMovementService } from './services/inventory-movement.service';
import { InventoryBatchService } from './services/inventory-batch.service';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../../users/users.module';
import { User } from '../../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryMovement, Inventory, User]),
    forwardRef(() => InventoryModule),
    UsersModule,
  ],
  providers: [
    InventoryMovementResolver,
    InventoryMovementService,
    InventoryBatchService,
  ],
  exports: [InventoryMovementResolver, InventoryMovementService],
})
export class InventoryMovementModule {}
