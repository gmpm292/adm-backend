import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SystemUtilsService } from './services/system-utils.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { ScopedAccessService } from '../modules/scoped-access/services/scoped-access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [ScopedAccessService, SystemUtilsService],
  exports: [ScopedAccessService, SystemUtilsService],
})
export class CoreModule implements OnModuleInit {
  constructor(private readonly systemUtils: SystemUtilsService) {}

  async onModuleInit() {
    await this.systemUtils.loadSystemUser();
  }
}
