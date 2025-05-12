import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './entities/worker.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentRule } from '../payment-rule/entities/payment-rule.entity';
import { Office } from '../../company/office/entities/co_office.entity';
import { UsersModule } from '../../users/users.module';
import { PaymentRuleModule } from '../payment-rule/payment-rule.module';
import { OfficeModule } from '../../company/office/office.module';
import { WorkerResolver } from './resolvers/worker.resolver';
import { WorkerService } from './services/worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, User, PaymentRule, Office]),
    forwardRef(() => UsersModule),
    forwardRef(() => PaymentRuleModule),
    forwardRef(() => OfficeModule),
  ],
  providers: [WorkerResolver, WorkerService],
  exports: [WorkerResolver, WorkerService],
})
export class WorkerModule {}
