import { Module } from '@nestjs/common';

import { AppEventService } from './services/app-event.service';
import { GraphqlModule } from '../../common/graphql/graphql.module';
import { LoggerModule } from '../../common/logger';
import { PubsubModule } from '../../common/graphql/pubsub/pubsub.module';

@Module({
  imports: [GraphqlModule, LoggerModule, PubsubModule],
  providers: [
    AppEventService,
    //AppEventResolver
  ],
  exports: [AppEventService],
})
export class AppEventModule {}
