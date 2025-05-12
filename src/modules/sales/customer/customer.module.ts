import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerResolver } from './resolvers/customer.resolver';
import { CustomerService } from './services/customer.service';
import { Customer } from './entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Sale } from '../sale/entities/sale.entity';
import { SaleModule } from '../sale/sale.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, User, Sale]),
    forwardRef(() => SaleModule),
  ],
  providers: [CustomerResolver, CustomerService],
  exports: [CustomerResolver, CustomerService],
})
export class CustomerModule {}
