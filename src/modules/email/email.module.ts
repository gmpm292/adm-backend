/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailResolver } from './resolvers/email.resolver';
import { EmailService } from './servises/email.service';
import { EmailTransportService } from './servises/email.transport';
import { ConfigModule } from '../../common/config';
import { EmailOAuth2Token } from './entities/email-oauth2-token.entity';
import { OAuth2Service } from './servises/oauth2.service';

import { EmailHealthService } from './servises/email-health.service';
import { EmailOAuthResolver } from './resolvers/email-oauth.resolver';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Email, EmailTemplate, EmailOAuth2Token]),
    ConfigModule,
  ],
  providers: [
    EmailService,
    EmailTransportService,
    EmailResolver,
    OAuth2Service,
    EmailHealthService,
    EmailOAuthResolver,
  ],
  exports: [EmailService, OAuth2Service, EmailHealthService],
})
export class EmailModule implements OnModuleInit {
  private readonly logger = new Logger(EmailModule.name);

  constructor(
    private readonly emailTransportService: EmailTransportService,
    private readonly oAuth2Service: OAuth2Service,
    private readonly emailService: EmailService,
    private readonly healthService: EmailHealthService,
  ) {}

  async onModuleInit() {
    await this.load();
  }

  async load() {
    try {
      this.logger.log('Initializing Email module...');
      this.emailTransportService.initializeOAuth2Client();
      this.oAuth2Service.initializeOAuth2Client();
      await this.emailService.init();
      await this.healthService.checkEmailStatus();
    } catch (error) {
      this.logger.error('Error initializing Email module', error.stack);
    }
  }
}
