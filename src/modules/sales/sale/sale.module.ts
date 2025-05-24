import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleResolver } from './resolvers/sale.resolver';
import { SaleService } from './services/sale.service';
import { Sale } from './entities/sale.entity';
import { User } from '../../users/entities/user.entity';
import { Customer } from '../customer/entities/customer.entity';
import { SaleDetail } from '../sale-detail/entities/sale-detail.entity';
import { CustomerModule } from '../customer/customer.module';
import { SaleDetailModule } from '../sale-detail/sale-detail.module';
import { ProductModule } from '../../inventory/product/product.module';
import { WorkerModule } from '../../payroll/worker/worker.module';
import { InventoryModule } from '../../inventory/inventory/inventory.module';
import { InventoryMovementModule } from '../../inventory/inventory-movement/inventory-movement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, User, Customer, SaleDetail]),
    forwardRef(() => CustomerModule),
    forwardRef(() => SaleDetailModule),
    forwardRef(() => ProductModule),
    forwardRef(() => WorkerModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => InventoryMovementModule),
  ],
  providers: [SaleResolver, SaleService],
  exports: [SaleResolver, SaleService],
})
export class SaleModule {}
