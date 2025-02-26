import { Global, Module } from '@nestjs/common';

import { AppLoggerService } from './logger.service';
//import { LogResolver } from './log/resolvers/log.resolver';
//import { LogPostgresService } from './log/services/log-postgres.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './log/entities/log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Log])],
  providers: [AppLoggerService /*,LogPostgresService, LogResolver*/],
  exports: [AppLoggerService],
})
export class LoggerModule {}
