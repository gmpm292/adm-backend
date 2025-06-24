import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SystemUtilsService } from './services/system-utils.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { ScopedAccessService } from '../modules/scoped-access/services/scoped-access.service';
import { AppMailerModule } from './mailer/app-mailer.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User]), AppMailerModule],
  providers: [ScopedAccessService, SystemUtilsService],
  exports: [ScopedAccessService, SystemUtilsService],
})
export class CoreModule implements OnModuleInit {
  constructor(private readonly systemUtils: SystemUtilsService) {}

  async onModuleInit() {
    await this.systemUtils.loadSystemUser();
  }
}
