import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigResourceService } from './services/config-resource.service';
import { Config } from './entities/config.entity';
import { ConfigResourceResolver } from './resolvers/config-resource.resolver';
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Config])],
  providers: [ConfigResourceResolver, ConfigResourceService],
  exports: [ConfigResourceService],
})
export class ConfigResourceModule {}
