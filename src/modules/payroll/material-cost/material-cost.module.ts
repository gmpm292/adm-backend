import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialCostResolver } from './resolvers/material-cost.resolver';
import { MaterialCostService } from './services/material-cost.service';
import { MaterialCost } from './entities/material-cost.entity';
import { User } from '../../users/entities/user.entity';

import { CurrencyModule } from '../currency/currency.module';
import { ProductModule } from '../../inventory/product/product.module';
import { UnitOfMeasureModule } from '../../inventory/unit-of-measure/unit-of-measure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialCost, User]),
    forwardRef(() => ProductModule),
    forwardRef(() => UnitOfMeasureModule),
    forwardRef(() => CurrencyModule),
  ],
  providers: [MaterialCostResolver, MaterialCostService],
  exports: [MaterialCostResolver, MaterialCostService],
})
export class MaterialCostModule {}
