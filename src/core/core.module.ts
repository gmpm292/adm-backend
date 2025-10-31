import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SystemUtilsService } from './services/system-utils.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { AppMailerModule } from './mailer/app-mailer.module';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, AppMailerModule],
  providers: [SystemUtilsService],
  exports: [SystemUtilsService],
})
export class CoreModule implements OnModuleInit {
  constructor(private readonly systemUtils: SystemUtilsService) {}

  async onModuleInit() {
    await this.systemUtils.loadSystemUser();
  }
}
