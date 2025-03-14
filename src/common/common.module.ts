import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { DatabaseModule } from './database';
import { GraphqlModule } from './graphql/graphql.module';
import { CacheManagerModule } from './cache-manager-module/cache-manager-module.module';

@Module({
  imports: [ConfigModule, DatabaseModule, GraphqlModule, CacheManagerModule],
})
export class CommonModule {}
