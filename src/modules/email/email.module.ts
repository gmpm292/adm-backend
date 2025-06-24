import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailResolver } from './resolvers/email.resolver';
import { EmailService } from './servises/email.service';
import { EmailTransportService } from './servises/email.transport';
import { ConfigModule } from '../../common/config';

@Module({
  imports: [TypeOrmModule.forFeature([Email, EmailTemplate]), ConfigModule],
  providers: [EmailService, EmailTransportService, EmailResolver],
  exports: [EmailService],
})
export class EmailModule {}
