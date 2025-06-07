import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SystemUtilsService } from './services/system-utils.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { ScopedAccessService } from '../modules/scoped-access/services/scoped-access.service';
import { AppMailerService } from './mailer/app-mailer.service';
import { IAppMailer } from './mailer/app-mailer.interface';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    ScopedAccessService,
    SystemUtilsService,
    {
      provide: IAppMailer,
      useClass: AppMailerService,
    },
  ],
  exports: [ScopedAccessService, SystemUtilsService, IAppMailer],
})
export class CoreModule implements OnModuleInit {
  constructor(private readonly systemUtils: SystemUtilsService) {}

  async onModuleInit() {
    await this.systemUtils.loadSystemUser();
  }
}
