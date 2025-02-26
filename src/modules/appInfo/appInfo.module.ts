import { Module } from '@nestjs/common';

import { AppInfoController } from './controllers/appInfo.controller';
import { AppInfoResolver } from './resolvers/appInfo.resolver';
import { AppInfoService } from './services/appInfo.service';

import { DatabaseModule } from '../../common/database';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { GraphqlModule } from '../../common/graphql/graphql.module';
import { LoggerModule } from '../../common/logger';
import { PubsubModule } from '../../common/graphql/pubsub/pubsub.module';

@Module({
  imports: [
    GraphqlModule,
    LoggerModule,
    PubsubModule,
    DatabaseModule,
    TerminusModule,
    HttpModule,
  ],
  controllers: [AppInfoController],
  providers: [AppInfoService, AppInfoResolver],
})
export class AppInfoModule {}
