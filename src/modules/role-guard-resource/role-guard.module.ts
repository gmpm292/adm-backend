import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoleGuardResolver } from './resolvers/role-guard.resolver';
import { RoleGuardService } from './services/role-guard.service';
import { RoleGuardEntity } from './entities/role-guard.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RoleGuardEntity]), DiscoveryModule],
  providers: [RoleGuardResolver, RoleGuardService],
  exports: [RoleGuardService],
})
export class RoleGuardModule {}
