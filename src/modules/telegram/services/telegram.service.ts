/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { compile } from 'handlebars';
import { TelegramMessage } from '../entities/telegram-message.entity';
import { TelegramTemplate } from '../entities/telegram-template.entity';
import { TelegramStatus } from '../enums/telegram-status.enum';
import { TelegramTransportService } from './telegram-transport.service';
import {
  SendTelegramMessageInput,
  TelegramRecipientInput,
} from '../dtos/send-telegram-message.input';

import { TelegramStatsOutput } from '../dtos/telegram-stats.output';
import { CreateTelegramTemplateInput } from '../dtos/create-telegram-template.input';
import { TelegramTransportResult } from '../interfaces/elegram-transport-result.interface';
import { TelegramError } from '../enums/telegram-error.interface';
import { UpdateTelegramTemplateInput } from '../dtos/update-telegram-template.input';

/**
 * Envía mensajes de Telegram (texto directo o plantilla Handlebars), guarda
 * cada envío en `telegram_message` y administra las plantillas.
 */
@Injectable()
export class TelegramService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramService.name);
  private readonly maxRetries: number = 3;

  constructor(
    @InjectRepository(TelegramMessage)
    private readonly messageRepository: Repository<TelegramMessage>,
    @InjectRepository(TelegramTemplate)
    private readonly templateRepository: Repository<TelegramTemplate>,
    private readonly transportService: TelegramTransportService,
  ) {}

  /**
   * Al arrancar reintenta los envíos fallidos. Va en `onApplicationBootstrap`
   * porque los bots se crean en `TelegramModule.onModuleInit`, que corre
   * después del `onModuleInit` de este servicio.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.retryFailedMessages();
  }

  /**
   * Envía un mensaje por bot (`chatId`) o por la cuenta de usuario
   * (`phoneNumber`). Lo guarda como `pending` y luego como SENT o FAILED
   * (si falla, además lanza el error).
   */
  async sendMessage(data: SendTelegramMessageInput): Promise<TelegramMessage> {
    const messageData = {
      chatId: data.chatId,
      phoneNumber: data.phoneNumber,
      recipients: data.recipients || [],
      message: data.message,
      messageType: data.messageType || 'text',
      attachments: data.attachments,
      context: data.context,
      status: 'pending' as TelegramStatus,
      botTokenKey: data.botTokenKey || 'default',
      templateId: data.templateId,
      isPhoneBased: !!data.phoneNumber,
    };

    const message = this.messageRepository.create(messageData);

    await this.messageRepository.save(message);

    return this.deliver(message, data);
  }

  /**
   * Hace el envío de un registro ya guardado (nuevo o reintento) y lo marca
   * como SENT o FAILED. El transporte no lanza: devuelve `success: false`.
   */
  private async deliver(
    message: TelegramMessage,
    data: SendTelegramMessageInput,
  ): Promise<TelegramMessage> {
    try {
      await this.processTemplateIfNeeded(data, message);
      const result = await this.transportService.sendMessage({
        chatId: data.chatId,
        phoneNumber: data.phoneNumber,
        message: message.message,
        messageType: message.messageType,
        attachments: data.attachments,
        botTokenKey: data.botTokenKey ?? 'default',
      });

      if (!result.success) {
        throw Object.assign(
          new Error(result.error?.message ?? 'Telegram send failed'),
          { code: result.error?.code },
        );
      }

      return await this.handleSuccess(message, result);
    } catch (error) {
      return await this.handleError(message, error);
    }
  }

  // Métodos auxiliares privados
  /**
   * Si llega `templateId` (el nombre de una plantilla activa), rellena el
   * mensaje con `context` o el `defaultContext` y toma su tipo de mensaje.
   */
  private async processTemplateIfNeeded(
    data: SendTelegramMessageInput,
    message: TelegramMessage,
  ): Promise<void> {
    if (data.templateId) {
      const template = await this.templateRepository.findOne({
        where: { name: data.templateId, isActive: true },
      });

      if (!template) {
        throw new Error(
          `Template with ID ${data.templateId} not found or inactive`,
        );
      }

      const compiledMessage = compile(template.message);
      message.message = compiledMessage(
        data.context || template.defaultContext || {},
      );
      message.messageType = template.messageType;
      await this.messageRepository.save(message);
    }
  }

  /**
   * Marca el envío como SENT. Si se envió por teléfono, guarda como `chatId`
   * el id de usuario de Telegram que se resolvió.
   */
  private async handleSuccess(
    message: TelegramMessage,
    result: TelegramTransportResult,
  ): Promise<TelegramMessage> {
    message.status = TelegramStatus.SENT;
    message.sentAt = new Date();

    // Verificación segura con type guard
    if (message.phoneNumber && result.userId) {
      message.chatId = result.userId;
    }

    return this.messageRepository.save(message);
  }

  /** Marca el envío como FAILED, guarda el error y lo vuelve a lanzar. */
  private async handleError(
    message: TelegramMessage,
    error: Error & { code?: string },
  ): Promise<TelegramMessage> {
    message.status = TelegramStatus.FAILED;
    message.error = this.createErrorObject(error);
    await this.messageRepository.save(message);

    this.logger.error(
      `Failed to send Telegram message: ${error.message}`,
      error.stack,
    );
    throw error;
  }

  private createErrorObject(error: Error & { code?: string }): TelegramError {
    return {
      message: error.message,
      stack: error.stack,
      code: error.code,
      timestamp: new Date(),
    };
  }

  // Métodos para reintentos
  /**
   * Reintenta los mensajes FAILED con menos de `maxRetries` intentos sobre
   * el mismo registro: suma `retryCount` y queda como SENT o FAILED.
   */
  async retryFailedMessages(
    maxRetries: number = this.maxRetries,
  ): Promise<void> {
    const failedMessages = await this.messageRepository.find({
      where: {
        status: TelegramStatus.FAILED,
        retryCount: LessThan(maxRetries),
      },
    });

    for (const message of failedMessages) {
      await this.retrySingleMessage(message);
    }
  }

  private async retrySingleMessage(message: TelegramMessage): Promise<void> {
    message.status = TelegramStatus.RETRYING;
    message.retryCount += 1;
    message.lastRetryAt = new Date();
    await this.messageRepository.save(message);

    try {
      await this.deliver(message, {
        chatId: message.chatId,
        phoneNumber: message.phoneNumber,
        recipients: message.recipients as TelegramRecipientInput[],
        message: message.message,
        messageType: message.messageType as any,
        attachments: message.attachments as any,
        context: message.context,
        botTokenKey: message.botTokenKey,
        templateId: message.templateId,
      });
    } catch {
      // `deliver` ya lo dejó como FAILED con el error; se reintentará
      // mientras no llegue a `maxRetries`.
    }
  }

  // Métodos CRUD para plantillas
  /** Crea una plantilla (activa por defecto); el nombre no se repite. */
  async createTemplate(
    input: CreateTelegramTemplateInput,
  ): Promise<TelegramTemplate> {
    const existingTemplate = await this.templateRepository.findOne({
      where: { name: input.name },
    });

    if (existingTemplate) {
      throw new Error(`Template with name "${input.name}" already exists`);
    }

    const template = this.templateRepository.create({
      ...input,
      isActive: input.isActive ?? true,
    });

    return await this.templateRepository.save(template);
  }

  async updateTemplate(
    id: string,
    input: UpdateTelegramTemplateInput,
  ): Promise<TelegramTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new Error(`Template with ID ${id} not found`);
    }

    const updatedTemplate = this.templateRepository.merge(template, input);
    return await this.templateRepository.save(updatedTemplate);
  }

  async findAllTemplates(): Promise<TelegramTemplate[]> {
    return await this.templateRepository.find();
  }

  async findTemplateById(id: string): Promise<TelegramTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new Error(`Template with ID ${id} not found`);
    }

    return template;
  }

  // Métodos para mensajes
  async findAllMessages(): Promise<TelegramMessage[]> {
    return await this.messageRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findMessageById(id: string): Promise<TelegramMessage> {
    const message = await this.messageRepository.findOne({ where: { id } });

    if (!message) {
      throw new Error(`Message with ID ${id} not found`);
    }

    return message;
  }

  // Métodos para estadísticas
  /**
   * Totales por estado, con desglose por bot y por tipo de mensaje.
   * `successRate` es una fracción (0-1), no un porcentaje.
   */
  async getStats(): Promise<TelegramStatsOutput> {
    const [total, sent, delivered, failed, pending] = await Promise.all([
      this.messageRepository.count(),
      this.messageRepository.count({ where: { status: TelegramStatus.SENT } }),
      this.messageRepository.count({
        where: { status: TelegramStatus.DELIVERED },
      }),
      this.messageRepository.count({
        where: { status: TelegramStatus.FAILED },
      }),
      this.messageRepository.count({
        where: { status: TelegramStatus.PENDING },
      }),
    ]);

    const successRate = total > 0 ? (sent + delivered) / total : 0;

    return {
      total,
      sent,
      delivered,
      failed,
      pending,
      successRate,
      byBotToken: await this.getStatsByBotToken(),
      byMessageType: await this.getStatsByMessageType(),
    };
  }

  private async getStatsByBotToken(): Promise<
    Record<string, { sent: number; failed: number }>
  > {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.botTokenKey', 'botTokenKey')
      .addSelect(
        'SUM(CASE WHEN message.status = :sent THEN 1 ELSE 0 END)',
        'sent',
      )
      .addSelect(
        'SUM(CASE WHEN message.status = :failed THEN 1 ELSE 0 END)',
        'failed',
      )
      .setParameters({
        sent: TelegramStatus.SENT,
        failed: TelegramStatus.FAILED,
      })
      .groupBy('message.botTokenKey')
      .getRawMany();

    return result.reduce((acc, { botTokenKey, sent, failed }) => {
      acc[botTokenKey] = {
        sent: parseInt(sent, 10),
        failed: parseInt(failed, 10),
      };
      return acc;
    }, {});
  }

  private async getStatsByMessageType(): Promise<
    Record<string, { sent: number; failed: number }>
  > {
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.messageType', 'messageType')
      .addSelect(
        'SUM(CASE WHEN message.status = :sent THEN 1 ELSE 0 END)',
        'sent',
      )
      .addSelect(
        'SUM(CASE WHEN message.status = :failed THEN 1 ELSE 0 END)',
        'failed',
      )
      .setParameters({
        sent: TelegramStatus.SENT,
        failed: TelegramStatus.FAILED,
      })
      .groupBy('message.messageType')
      .getRawMany();

    return result.reduce((acc, { messageType, sent, failed }) => {
      acc[messageType] = {
        sent: parseInt(sent, 10),
        failed: parseInt(failed, 10),
      };
      return acc;
    }, {});
  }
}
