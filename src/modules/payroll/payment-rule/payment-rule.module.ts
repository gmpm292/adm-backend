import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentRule } from './entities/payment-rule.entity';
import { PaymentRuleResolver } from './resolvers/payment-rule.resolver';
import { PaymentRuleService } from './services/payment-rule.service';
import { ProductModule } from '../../inventory/product/product.module';
import { CategoryModule } from '../../inventory/category/category.module';
import { WorkerModule } from '../worker/worker.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRule]),
    forwardRef(() => WorkerModule),
    forwardRef(() => ProductModule),
    forwardRef(() => CategoryModule),
  ],
  providers: [PaymentRuleResolver, PaymentRuleService],
  exports: [PaymentRuleResolver, PaymentRuleService],
})
export class PaymentRuleModule {}
