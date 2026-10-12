import { Global, Module } from '@nestjs/common';

import { AppLoggerService } from './logger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './log/entities/log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Log])],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}
