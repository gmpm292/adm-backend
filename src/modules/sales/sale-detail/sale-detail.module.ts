import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleDetailResolver } from './resolvers/sale-detail.resolver';
import { SaleDetailService } from './services/sale-detail.service';
import { SaleDetail } from './entities/sale-detail.entity';
import { Sale } from '../sale/entities/sale.entity';
import { SaleModule } from '../sale/sale.module';
import { ProductModule } from '../../inventory/product/product.module';
import { Product } from '../../inventory/product/entities/product.entity';
import { Worker } from '../../payroll/worker/entities/worker.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleDetail, Sale, Product, Worker]),
    forwardRef(() => SaleModule),
    forwardRef(() => ProductModule),
  ],
  providers: [SaleDetailResolver, SaleDetailService],
  exports: [SaleDetailResolver, SaleDetailService],
})
export class SaleDetailModule {}
