import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Currency } from './entities/currency.entity';
import { CurrencyResolver } from './resolvers/currency.resolver';
import { CurrencyService } from './services/currency.service';
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Currency])],
  providers: [CurrencyResolver, CurrencyService],
  exports: [CurrencyResolver, CurrencyService],
})
export class CurrencyModule {}
