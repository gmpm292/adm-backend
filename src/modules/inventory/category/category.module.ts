import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryResolver } from './resolvers/category.resolver';
import { CategoryService } from './services/category.service';
import { Category } from './entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product, User])],
  providers: [CategoryResolver, CategoryService],
  exports: [CategoryResolver, CategoryService],
})
export class CategoryModule {}
