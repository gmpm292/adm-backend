import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import { getEnvFilesToLoad } from './helpers/loader.helper';
import { validate } from './helpers/validate.helper';
import { ConfigResourceModule } from './config-resource/config-resource.module';
import { RoleGuardModule } from '../../modules/role-guard-resource/role-guard.module';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      expandVariables: true,
      envFilePath: getEnvFilesToLoad(),
      validate,
      load: [],
    }),
    ConfigResourceModule,
    RoleGuardModule,
  ],
  providers: [ConfigService],
  exports: [NestConfigModule, ConfigService],
})
export class ConfigModule {}
