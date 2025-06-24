/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { EmailProvider } from '../enums/email-provider.enum';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ConfigService } from '../../../common/config';

@Injectable()
export class EmailTransportService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailTransportService.name);

  constructor(private configService: ConfigService) {}

  async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    const provider = this.configService.get<EmailProvider>('EMAIL_PROVIDER');

    switch (provider) {
      case EmailProvider.GMAIL_OAUTH2:
        this.transporter = await this.createOAuth2Transport();
        break;
      case EmailProvider.SMTP:
        this.transporter = this.createSmtpTransport();
        break;
      default:
        this.logger.error(`Unsupported email provider: ${provider}`);
    }

    return this.transporter;
  }

  private async createOAuth2Transport(): Promise<Transporter> {
    const clientId = this.configService.get<string>('EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EMAIL_SECRET_KEY');
    const redirectUri = this.configService.get<string>('EMAIL_REDIRECT_URI');
    const refreshToken = this.configService.get<string>('EMAIL_REFRESH_TOKEN');
    const userEmail = this.configService.get<string>('EMAIL_USER');

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri ||
      !refreshToken ||
      !userEmail
    ) {
      throw new Error('Faltan credenciales OAuth2 en la configuración');
    }

    const oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
    });

    // Configurar manejador de eventos para tokens
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        // Guardar el nuevo refresh_token si Google proporciona uno nuevo
        this.logger.error('Received new refresh token');
        // Aquí deberías implementar la lógica para guardar el nuevo token
      }
    });

    try {
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { token: accessToken } = await oauth2Client.getAccessToken();

      if (!accessToken) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      return createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId,
          clientSecret,
          refreshToken,
          accessToken,
        },
      });
    } catch (error) {
      this.logger.error('Error al configurar transporte OAuth2', error.stack);

      // Manejo específico de errores de OAuth2
      if (error.message.includes('invalid_grant')) {
        throw new Error(
          'El refresh token ha expirado o es inválido. Se necesita reautenticar.',
        );
      }

      throw new Error(`Error de autenticación OAuth2: ${error.message}`);
    }
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
}
