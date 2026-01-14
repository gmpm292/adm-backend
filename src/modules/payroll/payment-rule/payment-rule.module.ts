import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentRule } from './entities/payment-rule.entity';
import { PaymentRuleResolver } from './resolvers/payment-rule.resolver';
import { PaymentRuleService } from './services/payment-rule.service';
import { ProductModule } from '../../inventory/product/product.module';
import { CategoryModule } from '../../inventory/category/category.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRule]),
    ProductModule,
    CategoryModule,
  ],
  providers: [PaymentRuleResolver, PaymentRuleService],
  exports: [PaymentRuleResolver, PaymentRuleService],
})
export class PaymentRuleModule {}
