/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Email } from '../entities/email.entity';
import { EmailTemplate } from '../entities/email-template.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailTransportService } from './email.transport';
import { compile } from 'handlebars';
import { EmailProvider } from '../enums/email-provider.enum';
import { SendEmailInput } from '../dto/send-email.input';
import { EmailStats } from '../interfaces/email-stats.interface';
import { SentMessageInfo, Transporter } from 'nodemailer';
import { CreateEmailTemplateInput } from '../dto/create-email-template.input';
import { UpdateEmailTemplateInput } from '../dto/update-email-template.input';
import { NotFoundError } from '../../../core/errors/appErrors/NotFoundError.error';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { ConfigService } from '../../../common/config';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private oauth2Client!: OAuth2Client;
  private accessToken: string | null = null;
  private accessTokenExpiry: Date | null = null;
  private transporter!: Transporter;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
    private readonly transportService: EmailTransportService,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
  ) {
    this.initializeOAuth2Client();
  }

  async onModuleInit(): Promise<void> {
    await this.initializeTransport();

    if (this.configService.get('EMAIL_TEST_ON_STARTUP') === 'true') {
      await this.sendTestEmail();
    }
  }

  private initializeOAuth2Client(): void {
    const clientId = this.configService.get<string>('EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EMAIL_SECRET_KEY');
    const redirectUri = this.configService.get<string>('EMAIL_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error('Missing OAuth2 configuration');
    }

    this.oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
    });

    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        this.handleNewRefreshToken(tokens.refresh_token).catch((err) =>
          this.logger.error('Error handling new refresh token', err),
        );
      }
      if (tokens.access_token) {
        this.accessToken = tokens.access_token;
        this.accessTokenExpiry = new Date(
          Date.now() + (tokens.expiry_date ?? 3600 * 1000),
        );
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  private async handleNewRefreshToken(refreshToken: string): Promise<void> {
    this.logger.log('New refresh token received');
    // TODO: Implement secure persistence of new refresh token
    // Example: await this.saveRefreshToken(refreshToken);
  }

  private async ensureValidAccessToken(): Promise<void> {
    if (
      !this.accessToken ||
      (this.accessTokenExpiry !== null && new Date() > this.accessTokenExpiry)
    ) {
      await this.refreshAccessToken();
    }
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = this.configService.get<string>('EMAIL_REFRESH_TOKEN');
    if (!refreshToken) {
      this.logger.error('Refresh token not configured');
    }

    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const accessTokenResponse = await this.oauth2Client.getAccessToken();

      const token = accessTokenResponse?.token;
      if (!token) {
        throw new Error('Failed to get access token');
      }

      this.accessToken = token;
      this.accessTokenExpiry = new Date(Date.now() + 3500 * 1000); // 58 min approx.
    } catch (error) {
      this.logger.error(
        'Error refreshing access token',
        (error as Error).stack,
      );
      //throw error;
    }
  }

  private async initializeTransport(): Promise<void> {
    await this.ensureValidAccessToken();

    this.transporter = await this.transportService.getTransporter();
  }

  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(
      this.configService.get<string>('ENCRYPTION_KEY') ??
        'default-key-32-chars-long-need',
      'utf-8',
    );
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptToken(encryptedToken: string): string {
    const [ivHex, encryptedHex] = encryptedToken.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted token format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const key = Buffer.from(
      this.configService.get<string>('ENCRYPTION_KEY') ??
        'default-key-32-chars-long-need',
      'utf-8',
    );
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private async sendTestEmail(): Promise<void> {
    const testEmail = this.configService.get<string>('EMAIL_TEST_RECIPIENT');
    if (!testEmail) {
      this.logger.warn(
        'EMAIL_TEST_RECIPIENT not configured - skipping test email',
      );
      return;
    }

    this.logger.log(`Sending test email to: ${testEmail}`);

    try {
      const result = await this.sendEmail({
        to: testEmail,
        subject: 'Prueba de servicio de correo',
        body: `
          <h1>¡Este es un correo de prueba!</h1>
          <p>Si estás recibiendo este mensaje, el servicio de correo de tu aplicación está configurado correctamente.</p>
          <p><strong>Fecha de envío:</strong> ${new Date().toISOString()}</p>
        `,
      });
      this.logger.log(`Test email sent successfully! Email ID: ${result.id}`);
    } catch (error) {
      this.logger.error('Failed to send test email', (error as Error).stack);
    }
  }

  async sendEmail(data: SendEmailInput): Promise<Email> {
    if (!data.templateId && (!data.body || !data.subject)) {
      throw new Error(
        'Either templateId or both body and subject must be provided',
      );
    }

    if (!this.isValidEmail(data.to)) {
      throw new Error('Invalid recipient email address');
    }

    const emailRecord = this.emailRepository.create({
      to: data.to,
      subject: data.subject,
      body: data.body,
      cc: data.cc,
      bcc: data.bcc,
      context: data.context,
      templateId: data.templateId,
      attachments: data.attachments,
      status: EmailStatus.PENDING,
      provider: this.configService.get<EmailProvider>('EMAIL_PROVIDER'),
      from: `"${this.configService.get<string>('FROM')}" <${this.configService.get<string>(
        'FROM_EMAIL',
      )}>`,
      retryCount: 0,
    });

    await this.emailRepository.save(emailRecord);

    try {
      if (data.templateId) {
        const template = await this.emailTemplateRepository.findOne({
          where: { id: data.templateId, isActive: true },
        });

        if (!template) {
          throw new NotFoundError(
            `Template with ID ${data.templateId} not found or inactive`,
          );
        }

        const compiledSubject = compile(template.subject);
        const compiledBody = compile(template.body);

        emailRecord.subject = compiledSubject(
          data.context ?? template.defaultContext ?? {},
        );
        emailRecord.body = compiledBody(
          data.context ?? template.defaultContext ?? {},
        );

        await this.emailRepository.save(emailRecord);
      }

      await this.ensureValidAccessToken();

      const mailOptions = {
        from: emailRecord.from,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: emailRecord.subject,
        html: emailRecord.body,
        attachments: data.attachments,
      };

      const info: SentMessageInfo =
        await this.transporter.sendMail(mailOptions);

      emailRecord.status = EmailStatus.SENT;
      emailRecord.sentAt = new Date();
      await this.emailRepository.save(emailRecord);

      this.logger.log(`Email sent to ${data.to}: ${info.messageId}`);

      return emailRecord;
    } catch (error) {
      const err = error as Error;

      if (err.message.includes('invalid_grant')) {
        this.logger.error(
          'OAuth2 token expired or revoked - needs reauthentication',
        );
      }

      emailRecord.status = EmailStatus.FAILED;
      emailRecord.error = {
        message: err.message,
        stack: err.stack,
        code: (error as any)?.code,
      };
      await this.emailRepository.save(emailRecord);

      this.logger.error(`Failed to send email to ${data.to}: ${err.message}`);

      throw err;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async findAll(): Promise<Email[]> {
    return this.emailRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Email> {
    const email = await this.emailRepository.findOne({ where: { id } });
    if (!email) throw new NotFoundError('Email not found');
    return email;
  }

  async findAllTemplates(): Promise<EmailTemplate[]> {
    return this.emailTemplateRepository.find({ order: { name: 'ASC' } });
  }

  async findTemplateById(id: string): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id },
    });
    if (!template) throw new NotFoundError('Template not found');
    return template;
  }

  async createTemplate(
    input: CreateEmailTemplateInput,
  ): Promise<EmailTemplate> {
    const existingTemplate = await this.emailTemplateRepository.findOne({
      where: { name: input.name },
    });

    if (existingTemplate) {
      throw new Error('Template with this name already exists');
    }

    const template = this.emailTemplateRepository.create(input);
    return this.emailTemplateRepository.save(template);
  }

  async updateTemplate(
    input: UpdateEmailTemplateInput,
  ): Promise<EmailTemplate> {
    const template = await this.findTemplateById(input.id);
    const updatedTemplate = { ...template, ...input };
    await this.emailTemplateRepository.update(input.id, updatedTemplate);
    return this.findTemplateById(input.id);
  }

  async retryFailedEmails(maxRetries = 3): Promise<void> {
    const failedEmails = await this.emailRepository.find({
      where: {
        status: EmailStatus.FAILED,
        retryCount: LessThan(maxRetries),
      },
    });

    for (const email of failedEmails) {
      try {
        email.status = EmailStatus.RETRYING;
        await this.emailRepository.save(email);

        await this.sendEmail({
          to: email.to,
          subject: email.subject,
          body: email.body,
          cc: email.cc,
          bcc: email.bcc,
          context: email.context,
          templateId: email.templateId,
          attachments: email.attachments,
        });

        email.retryCount += 1;
        email.lastRetryAt = new Date();
        await this.emailRepository.save(email);
      } catch (error) {
        const err = error as Error;
        email.retryCount += 1;
        email.lastRetryAt = new Date();
        email.error = {
          message: err.message,
          stack: err.stack,
          code: (error as any)?.code,
        };
        await this.emailRepository.save(email);
      }
    }
  }

  async getStats(): Promise<EmailStats> {
    const [total, sent, failed, pending] = await Promise.all([
      this.emailRepository.count(),
      this.emailRepository.count({ where: { status: EmailStatus.SENT } }),
      this.emailRepository.count({ where: { status: EmailStatus.FAILED } }),
      this.emailRepository.count({ where: { status: EmailStatus.PENDING } }),
    ]);

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? (sent / total) * 100 : 0,
    };
  }

  async checkGoogleQuota(): Promise<{ limit: number; usage: number }> {
    try {
      return {
        limit: 2000,
        usage: await this.emailRepository.count({
          where: {
            provider: EmailProvider.GMAIL_OAUTH2,
            sentAt: MoreThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)),
          },
        }),
      };
    } catch (error) {
      this.logger.error('Error checking Google quota', error);
      return { limit: 0, usage: 0 };
    }
  }
}
