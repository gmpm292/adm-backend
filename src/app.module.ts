import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { ConfigModule } from './common/config';
import { LoggerModule } from './common/logger';
import { GraphqlModule } from './common/graphql/graphql.module';
import { AppInfoModule } from './modules/appInfo/appInfo.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    GraphqlModule,
    AppInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
