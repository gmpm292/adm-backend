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
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';

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
      this.emailTransportService.reset();
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
    // Con los datos actuales: pueden haber cambiado en Configuración
    this.initializeOAuth2Client();
    if (!this.oauth2Client) {
      throw new BadRequestError(
        'Falta configurar EMAIL_CLIENT_ID y EMAIL_SECRET_KEY en el grupo Email-OAuth2',
      );
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
    this.initializeOAuth2Client();
    if (!this.oauth2Client) {
      throw new BadRequestError(
        'Falta configurar EMAIL_CLIENT_ID y EMAIL_SECRET_KEY en el grupo Email-OAuth2',
      );
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
      // El envío busca el token por EMAIL_USER: otra cuenta no serviría
      const expected = this.configService.get<string>('EMAIL_USER');
      if (email.toLowerCase() !== expected?.toLowerCase()) {
        return {
          success: false,
          message: `Autorizaste ${email}, pero el correo se envía desde ${expected ?? '(EMAIL_USER sin configurar)'}. Entra con esa cuenta o cambia EMAIL_USER en Configuración.`,
        };
      }

      await this.emailTransportService.saveNewRefreshToken(
        email,
        tokens.refresh_token,
      );

      await this.reload();

      return {
        success: true,
        message: `Cuenta ${email} autorizada: ya se pueden enviar correos.`,
      };
    } catch (error) {
      this.logger.error('OAuth2 callback error', error);
      return {
        success: false,
        message: 'Google no aceptó la autorización. Inténtalo de nuevo.',
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
