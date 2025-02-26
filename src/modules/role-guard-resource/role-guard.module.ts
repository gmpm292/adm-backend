import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleGuardResolver } from './resolvers/role-guard.resolver';
import { RoleGuardService } from './services/role-guard.service';
import { RoleGuardEntity } from '../../core/entities/role-guard.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RoleGuardEntity])],
  providers: [
    //RoleGuardResolver,
    RoleGuardService,
  ],
  exports: [RoleGuardService],
})
export class RoleGuardModule {}
