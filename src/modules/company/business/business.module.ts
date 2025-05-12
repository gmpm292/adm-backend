import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BusinessResolver } from './resolvers/business.resolver';
import { BusinessService } from './services/business.service';
import { Business } from './entities/co_business.entity';
import { Office } from '../office/entities/co_office.entity';
import { User } from '../../users/entities/user.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Business, Office, User])],
  providers: [BusinessResolver, BusinessService],
  exports: [BusinessResolver, BusinessService],
})
export class BusinessModule {}
