/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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

import { ConfigService } from '../../../common/config';
import { EmailHealthService } from './email-health.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | undefined;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepository: Repository<Email>,
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
    private readonly transportService: EmailTransportService,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
    private readonly healthService: EmailHealthService,
  ) {}

  async init(): Promise<void> {
    await this.initializeTransport();

    const emailTestOnStartup = this.configService.get('EMAIL_TEST_ON_STARTUP');
    if (emailTestOnStartup === 'true' || emailTestOnStartup) {
      await this.sendTestEmail();
    }
  }

  private async initializeTransport(): Promise<void> {
    try {
      this.transporter = await this.transportService.getTransporter();
      if (!this.transporter) {
        this.logger.warn('Email transporter not initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize transport', error);
    }
  }

  private async sendTestEmail(): Promise<void> {
    const testEmail = this.configService.get<string>('EMAIL_TEST_RECIPIENT');
    if (!testEmail) {
      this.logger.warn('EMAIL_TEST_RECIPIENT not configured');
      return;
    }

    try {
      const status = await this.healthService.checkEmailStatus();
      if (!status.configured) {
        this.logger.warn('Email service not configured, skipping test email');
        return;
      }

      const result = await this.sendEmail({
        to: testEmail,
        subject: 'Prueba de servicio de correo',
        body: `
          <h1>¡Este es un correo de prueba!</h1>
          <p>Si estás recibiendo este mensaje, el servicio de correo está configurado correctamente.</p>
          <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
        `,
      });
      this.logger.log(`Test email sent successfully: ${result.id}`);
    } catch (error) {
      this.logger.error('Failed to send test email', error);
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
      from: this.getFromAddress(),
      retryCount: 0,
    });

    await this.emailRepository.save(emailRecord);

    try {
      if (data.templateId) {
        await this.applyTemplate(data, emailRecord);
      }

      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

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
      await this.handleEmailError(emailRecord, error);
      throw error;
    }
  }

  private getFromAddress(): string {
    return `"${this.configService.get<string>('FROM')}" <${this.configService.get<string>(
      'FROM_EMAIL',
    )}>`;
  }

  private async applyTemplate(
    data: SendEmailInput,
    emailRecord: Email,
  ): Promise<void> {
    const template = await this.emailTemplateRepository.findOne({
      where: { name: data.templateId, isActive: true },
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

  private async handleEmailError(
    emailRecord: Email,
    error: any,
  ): Promise<void> {
    const err = error as Error;

    emailRecord.status = EmailStatus.FAILED;
    emailRecord.error = {
      message: err.message,
      stack: err.stack,
      code: (error as any)?.code,
    };

    await this.emailRepository.save(emailRecord);
    this.logger.error(
      `Failed to send email to ${emailRecord.to}: ${err.message}`,
    );

    if (err.message.includes('invalid_grant')) {
      this.logger.error(
        'OAuth2 token expired or revoked - needs reauthentication',
      );
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
