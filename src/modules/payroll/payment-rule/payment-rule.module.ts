import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentRule } from './entities/payment-rule.entity';
import { PaymentRuleResolver } from './resolvers/payment-rule.resolver';
import { PaymentRuleService } from './services/payment-rule.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentRule])],
  providers: [PaymentRuleResolver, PaymentRuleService],
  exports: [PaymentRuleResolver, PaymentRuleService],
})
export class PaymentRuleModule {}
