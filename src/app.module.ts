import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger';
import { CommonModule } from './common/common.module';
import { Modules } from './modules/modules.module';

@Module({
  imports: [LoggerModule, CommonModule, Modules],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
