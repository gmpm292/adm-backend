import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitOfMeasureResolver } from './resolvers/unit-of-measure.resolver';
import { UnitOfMeasureService } from './services/unit-of-measure.service';
import { UnitOfMeasure } from './entities/unit-of-measure.entity';
import { User } from '../../users/entities/user.entity';
import { MaterialCost } from '../../payroll/material-cost/entities/material-cost.entity';
import { Product } from '../product/entities/product.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UnitOfMeasure, User, MaterialCost, Product]),
    forwardRef(() => MaterialCost),
  ],
  providers: [UnitOfMeasureResolver, UnitOfMeasureService],
  exports: [UnitOfMeasureService],
})
export class UnitOfMeasureModule {}
