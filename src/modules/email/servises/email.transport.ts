/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { EmailProvider } from '../enums/email-provider.enum';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ConfigService } from '../../../common/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailOAuth2Token } from '../entities/email-oauth2-token.entity';
import * as crypto from 'crypto';

@Injectable()
export class EmailTransportService {
  private transporter: Transporter | undefined;
  private readonly logger = new Logger(EmailTransportService.name);
  private oauth2Client: OAuth2Client | undefined;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailOAuth2Token)
    private readonly oauthTokenRepository: Repository<EmailOAuth2Token>,
  ) {}

  public initializeOAuth2Client(): void {
    const clientId = this.configService.get<string>('EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EMAIL_SECRET_KEY');

    if (clientId && clientSecret) {
      this.oauth2Client = new OAuth2Client({
        clientId,
        clientSecret,
      });
    } else {
      this.logger.warn('OAuth2 client not initialized - missing configuration');
    }
  }

  async getTransporter(): Promise<Transporter | undefined> {
    if (this.transporter) {
      return this.transporter;
    }

    const provider = this.configService.get<EmailProvider>('EMAIL_PROVIDER');

    try {
      switch (provider) {
        case EmailProvider.GMAIL_OAUTH2:
          this.transporter = await this.createOAuth2Transport();
          break;
        case EmailProvider.SMTP:
          this.transporter = this.createSmtpTransport();
          break;
        default:
          throw new Error(`Unsupported email provider: ${provider}`);
      }

      return this.transporter;
    } catch (error) {
      this.logger.error(`Failed to create transporter: ${error.message}`);
      return undefined;
    }
  }

  private async createOAuth2Transport(): Promise<Transporter | undefined> {
    if (!this.oauth2Client) {
      this.logger.error('OAuth2 client not initialized');
      return undefined;
    }

    const userEmail = this.configService.get<string>('EMAIL_USER');
    if (!userEmail) {
      this.logger.error('EMAIL_USER not configured');
      return undefined;
    }

    const tokenRecord = await this.oauthTokenRepository.findOne({
      where: { email: userEmail, isActive: true },
    });

    if (!tokenRecord) {
      this.logger.error('No active OAuth2 token found in database');
      return undefined;
    }

    const refreshToken = this.decryptToken(tokenRecord.encryptedRefreshToken);

    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { token: accessToken } = await this.oauth2Client.getAccessToken();

      if (!accessToken) {
        this.logger.error('Failed to get access token');
        return undefined;
      }

      await this.oauthTokenRepository.update(tokenRecord.id, {
        accessToken,
        accessTokenExpiry: new Date(Date.now() + 3500 * 1000), // 58 minutos
      });

      return createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId: this.oauth2Client._clientId,
          clientSecret: this.oauth2Client._clientSecret,
          refreshToken,
          accessToken,
        },
      });
    } catch (error) {
      this.logger.error('Error creating OAuth2 transport', error);

      if (error.message.includes('invalid_grant')) {
        await this.handleInvalidGrantError(tokenRecord);
      }

      return undefined;
    }
  }

  private async handleInvalidGrantError(
    tokenRecord: EmailOAuth2Token,
  ): Promise<void> {
    await this.oauthTokenRepository.update(tokenRecord.id, { isActive: false });
    this.logger.error(
      'OAuth2 token invalid. Marked as inactive. New authorization required.',
    );
  }

  private createSmtpTransport(): Transporter {
    const options: SMTPTransport.Options = {
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<boolean>('EMAIL_SECURE'),
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    return createTransport(options);
  }

  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(16); // 128-bit IV
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey || encryptionKey.length === 0) {
      throw new Error('Encryption key not configured');
    }

    const key = crypto.scryptSync(encryptionKey, 'salt', 32); // 256-bit key
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptToken(encryptedToken: string): string {
    try {
      if (!encryptedToken) {
        throw new Error('Encrypted token is empty');
      }

      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }

      const [ivHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');

      const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
      if (!encryptionKey || encryptionKey.length === 0) {
        throw new Error('Encryption key not configured');
      }

      const key = crypto.scryptSync(encryptionKey, 'salt', 32); // Igual que en encrypt

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([
        decipher.update(encryptedText),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Error decrypting token:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      // Evita revelar detalles técnicos en errores lanzados
      throw new Error('No se pudo descifrar el token');
    }
  }

  async saveNewRefreshToken(
    email: string,
    refreshToken: string,
  ): Promise<void> {
    const encryptedToken = this.encryptToken(refreshToken);

    await this.oauthTokenRepository.update(
      { email, isActive: true },
      { isActive: false },
    );

    const newToken = this.oauthTokenRepository.create({
      provider: 'google',
      encryptedRefreshToken: encryptedToken,
      email,
      isActive: true,
    });

    await this.oauthTokenRepository.save(newToken);
    this.logger.log(`New refresh token saved for ${email}`);
  }

  public async isOAuthConfigured(): Promise<{
    configured: boolean;
    authUrl?: string;
    email?: string;
  }> {
    try {
      if (!this.oauth2Client) {
        return { configured: false };
      }

      const userEmail = this.configService.get<string>('EMAIL_USER');
      if (!userEmail) {
        return { configured: false };
      }

      const token = await this.oauthTokenRepository.findOne({
        where: { email: userEmail, isActive: true },
      });

      if (token) {
        return {
          configured: true,
          email: token.email,
        };
      }

      const redirectUri = this.configService.get<string>('EMAIL_REDIRECT_URI');
      if (!redirectUri) {
        return { configured: false };
      }

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://mail.google.com/'],
        prompt: 'consent',
        redirect_uri: redirectUri,
      });

      return {
        configured: false,
        authUrl,
      };
    } catch (error) {
      this.logger.error('Error checking OAuth2 configuration', error);
      return { configured: false };
    }
  }
}
