import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScopedAccessResolver } from './resolvers/scoped-access.resolver';
import { ResourceScopedAccessService } from './services/resource-scoped-access.service';
import { ScopedAccessService } from './services/scoped-access.service';
import { ScopedAccessEntity } from './entities/scoped-access.entity';
import { Business } from '../company/business/entities/co_business.entity';
import { RoleGuardEntity } from '../role-guard-resource/entities/role-guard.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ScopedAccessEntity, Business, RoleGuardEntity]),
  ],
  providers: [
    ScopedAccessResolver,
    ResourceScopedAccessService,
    ScopedAccessService,
  ],
  exports: [
    ScopedAccessResolver,
    ResourceScopedAccessService,
    ScopedAccessService,
  ],
})
export class ScopedAccessModule {}
