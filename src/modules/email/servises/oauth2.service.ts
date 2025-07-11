/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '../../../common/config';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailOAuth2Token } from '../../email/entities/email-oauth2-token.entity';
import { EmailTransportService } from './email.transport';
import { EmailService } from './email.service';
import { EmailHealthService } from './email-health.service';

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private oauth2Client: OAuth2Client | undefined;

  constructor(
    private configService: ConfigService,
    private emailTransportService: EmailTransportService,
    @InjectRepository(EmailOAuth2Token)
    private oauthTokenRepository: Repository<EmailOAuth2Token>,

    private readonly emailService: EmailService,
    private readonly healthService: EmailHealthService,
  ) {}

  async reload() {
    try {
      this.logger.log('Initializing Email module...');
      this.emailTransportService.initializeOAuth2Client();
      this.initializeOAuth2Client();
      await this.emailService.init();
      await this.healthService.checkEmailStatus();
    } catch (error) {
      this.logger.error('Error initializing Email module', error.stack);
    }
  }

  public initializeOAuth2Client(): void {
    const clientId = this.configService.get<string>('EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EMAIL_SECRET_KEY');
    const redirectUri = this.configService.get<string>('EMAIL_REDIRECT_URI');

    if (!clientId || !clientSecret) {
      this.logger.warn('Missing OAuth2 configuration');
      return;
    }

    this.oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
    });
  }

  async generateAuthUrl(): Promise<string> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    //const SCOPES = ['https://mail.google.com/'];
    const SCOPES = [
      'https://mail.google.com/',
      'openid', // ← Esto asegura que se incluya el ID Token
      'email', // ← Para obtener el email del usuario
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleCallback(
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        throw new Error('No refresh token received');
      }

      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: this.configService.get<string>('EMAIL_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      const email = payload?.email;

      if (!email) {
        throw new Error('Could not retrieve email from token');
      }

      await this.emailTransportService.saveNewRefreshToken(
        email,
        tokens.refresh_token,
      );

      await this.reload();

      return {
        success: true,
        message: 'Authentication successful. Email service is now configured.',
      };
    } catch (error) {
      this.logger.error('OAuth2 callback error', error);
      return {
        success: false,
        message: 'Authentication failed. Please try again.',
      };
    }
  }

  async getCurrentTokenStatus(): Promise<{
    isConfigured: boolean;
    email?: string;
    expiresAt?: Date;
  }> {
    const token = await this.oauthTokenRepository.findOne({
      where: { isActive: true },
    });

    if (!token) {
      return { isConfigured: false };
    }

    return {
      isConfigured: true,
      email: token.email,
      expiresAt: token.accessTokenExpiry,
    };
  }
}
