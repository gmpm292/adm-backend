import { Injectable, Logger } from '@nestjs/common';
import { EmailTransportService } from './email.transport';
import { EmailProvider } from '../enums/email-provider.enum';
import { ConfigService } from '../../../common/config';

@Injectable()
export class EmailHealthService {
  private readonly logger = new Logger(EmailHealthService.name);

  constructor(
    private transportService: EmailTransportService,
    private configService: ConfigService,
  ) {}

  async checkEmailStatus(): Promise<{
    provider: string;
    configured: boolean;
    isHealthy: boolean;
    oauth?: {
      configured: boolean;
      authUrl?: string;
      email?: string;
    };
    smtpConfigured: boolean;
  }> {
    const provider =
      this.configService.get<EmailProvider>('EMAIL_PROVIDER') || 'UNKNOWN';
    const smtpConfigured = this.isSmtpConfigured();

    const baseResponse = {
      provider: provider.toString(), // Ensure provider is always a string
      configured: false,
      isHealthy: false,
      smtpConfigured,
    };

    try {
      if (provider === EmailProvider.GMAIL_OAUTH2) {
        const oauthStatus = await this.transportService.isOAuthConfigured();
        return {
          ...baseResponse,
          configured: oauthStatus.configured,
          isHealthy: oauthStatus.configured,
          oauth: oauthStatus,
        };
      }

      if (provider === EmailProvider.SMTP) {
        return {
          ...baseResponse,
          configured: smtpConfigured,
          isHealthy: smtpConfigured,
        };
      }

      return {
        ...baseResponse,
        provider: provider.toString(),
      };
    } catch (error) {
      this.logger.error('Error checking email status', error);
      return {
        ...baseResponse,
        provider: provider.toString(),
      };
    }
  }

  private isSmtpConfigured(): boolean {
    return (
      !!this.configService.get<string>('EMAIL_HOST') &&
      !!this.configService.get<string>('EMAIL_USER') &&
      !!this.configService.get<string>('EMAIL_PASSWORD')
    );
  }
}
