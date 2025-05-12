import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepartmentResolver } from './resolvers/department.resolver';
import { DepartmentService } from './services/department.service';
import { Department } from './entities/co_department.entity';
import { Office } from '../office/entities/co_office.entity';
import { User } from '../../users/entities/user.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Department, Office, User])],
  providers: [DepartmentResolver, DepartmentService],
  exports: [DepartmentResolver, DepartmentService],
})
export class DepartmentModule {}
