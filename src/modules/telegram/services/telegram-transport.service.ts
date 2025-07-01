/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TelegramMessageType } from '../enums/telegram-message-type.enum';
import { TelegramSendOptions } from '../interfaces/telegram-send-options.interface';
import { TelegramTransportResult } from '../interfaces/elegram-transport-result.interface';
import { ConfigService } from '../../../common/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import bigInt from 'big-integer';

@Injectable()
export class TelegramTransportService implements OnModuleInit {
  private readonly logger = new Logger(TelegramTransportService.name);
  private bots: Map<string, TelegramBot> = new Map();
  private client: TelegramClient;
  private session: StringSession;
  private isClientConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {}

  async init(): Promise<void> {
    // Configuración para el cliente de usuario (envío por número)
    const apiId = this.configService.get<number>('TELEGRAM_API_ID');
    const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');
    this.session = new StringSession(
      this.configService.get<string>('TELEGRAM_SESSION') || '',
    );

    if (apiId && apiHash) {
      this.client = new TelegramClient(this.session, apiId, apiHash, {
        connectionRetries: 5,
      });
    }

    // Inicializar bots desde la configuración JSON
    this.initializeBots();

    if (this.client) {
      await this.connectClient();
    }

    // Configurar webhooks para todos los bots
    await this.setupWebhooks();

    // Solo ejecutar pruebas en desarrollo
    //if (process.env.NODE_ENV === 'development') {
    //await this.testSendMessages();
    //}
  }

  private async setupWebhooks(): Promise<void> {
    const webhookBaseUrl = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_URL',
    );

    if (!webhookBaseUrl) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_URL no está configurado. Los Webhooks no se configurarán',
      );
      return;
    }

    for (const [botName, bot] of this.bots) {
      try {
        const webhookUrl = `${webhookBaseUrl}/telegram/webhooks/${botName}`;
        const secretToken = this.configService.get<string>(
          'TELEGRAM_SECRET_TOKEN',
        );

        await bot.setWebHook(webhookUrl, {
          secret_token: secretToken,
        });

        this.logger.log(`Webhook configurado para ${botName}: ${webhookUrl}`);

        // Verificar el estado del webhook
        const webhookInfo = await bot.getWebHookInfo();
        this.logger.debug(
          `Estado del webhook para ${botName}: ${JSON.stringify(webhookInfo)}`,
        );
      } catch (error) {
        this.logger.error(
          `Error al configurar webhook para ${botName}: ${error.message}`,
        );
      }
    }
  }

  private async testSendMessages(): Promise<void> {
    try {
      this.logger.log('=== INICIANDO PRUEBAS DE ENVÍO ===');

      // 1. Prueba de envío a chatId (bot)
      const botTestResult = await this.sendMessage({
        //chatId: 'TU_CHAT_ID_AQUI', // Reemplazar con un chatId real
        chatId: '1243966185',
        message: 'Este es un mensaje de prueba del bot',
        messageType: TelegramMessageType.TEXT,
        botTokenKey: 'casa',
      });

      this.logger.log(
        'Prueba bot:',
        botTestResult.success ? '✅ Éxito' : '❌ Fallo',
      );

      // 2. Prueba de envío a número de teléfono (client)
      if (this.client) {
        const phoneTestResult = await this.sendMessage({
          phoneNumber: '+1234567890', // Reemplazar con un número real
          message: 'Este es un mensaje de prueba por teléfono',
          messageType: TelegramMessageType.TEXT,
        });

        this.logger.log(
          'Prueba teléfono:',
          phoneTestResult.success ? '✅ Éxito' : '❌ Fallo',
        );
      } else {
        this.logger.warn(
          'Cliente no configurado, omitiendo prueba de teléfono',
        );
      }

      this.logger.log('=== PRUEBAS COMPLETADAS ===');
    } catch (error) {
      this.logger.error('Error en pruebas:', error);
    }
  }

  private initializeBots(): void {
    try {
      // Obtener el string JSON de la configuración
      const botsConfigString = this.configService.get<string>('TELEGRAM_BOTS');

      // Parsear el string JSON a objeto
      if (!botsConfigString || botsConfigString == '') return;
      const botsConfig = JSON.parse(botsConfigString) as Record<string, string>;

      // Iterar sobre cada bot en la configuración
      for (const [botName, token] of Object.entries(botsConfig)) {
        try {
          // Verificar que el token tenga el formato correcto
          if (!token || !/^\d+:[a-zA-Z0-9_-]+$/.test(token)) {
            this.logger.warn(`Invalid token format for bot ${botName}`);
            continue;
          }

          const bot = new TelegramBot(token, { polling: false });
          this.bots.set(botName, bot);
          this.logger.log(`Bot ${botName} initialized successfully`);
        } catch (error) {
          this.logger.error(
            `Failed to initialize bot ${botName}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize bots from configuration', error);
      throw new Error('Invalid TELEGRAM_BOTS configuration format');
    }
  }

  private async connectClient(): Promise<void> {
    if (!this.isClientConnected && this.client) {
      await this.client.connect();
      this.isClientConnected = true;

      // Guardar la sesión para reconexiones
      const newSession = this.client.session.save();
      await this.configService.set('TELEGRAM_SESSION', newSession);
      this.logger.log('Telegram Client connected successfully');
    }
  }

  async getBot(tokenKey: string): Promise<TelegramBot> {
    const bot = this.bots.get(tokenKey);
    if (!bot) {
      throw new Error(`Bot with key ${tokenKey} not found`);
    }
    return bot;
  }

  async sendMessage(
    options: TelegramSendOptions,
  ): Promise<TelegramTransportResult> {
    try {
      if (options.phoneNumber) {
        return await this.sendToPhoneNumber(options);
      } else if (options.chatId) {
        return await this.sendViaBot(options);
      }
      throw new Error('Either chatId or phoneNumber must be provided');
    } catch (error) {
      this.logger.error('Failed to send message', error);
      return {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async sendViaBot(
    options: TelegramSendOptions,
  ): Promise<TelegramTransportResult> {
    const bot = await this.getBot(options.botTokenKey || 'default');

    try {
      let result: TelegramBot.Message;

      switch (options.messageType) {
        case TelegramMessageType.PHOTO:
          this.validateAttachments(options, 'Photo');
          result = await bot.sendPhoto(
            options.chatId as string,
            options.attachments![0].url,
            { caption: options.message, parse_mode: 'HTML' },
          );
          break;

        case TelegramMessageType.DOCUMENT:
          this.validateAttachments(options, 'Document');
          result = await bot.sendDocument(
            options.chatId as string,
            options.attachments![0].url,
            { caption: options.message },
          );
          break;

        default:
          const parseMode = this.getParseMode(options.messageType);
          result = await bot.sendMessage(
            options.chatId as string,
            options.message,
            {
              parse_mode: parseMode,
            },
          );
      }

      return {
        success: true,
        messageId: result.message_id,
        chatId: result.chat.id.toString(),
        timestamp: new Date(result.date * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to send via bot: ${error.message}`);
      throw error;
    }
  }

  private async sendToPhoneNumber(
    options: TelegramSendOptions,
  ): Promise<TelegramTransportResult> {
    if (!this.client) {
      throw new Error('Telegram client is not initialized');
    }

    try {
      const clientId = bigInt.randBetween(bigInt(1), bigInt(1000000));
      const importResult = await this.client.invoke(
        new Api.contacts.ImportContacts({
          contacts: [
            new Api.InputPhoneContact({
              clientId,
              phone: options.phoneNumber as string,
              firstName: 'Notification',
              lastName: 'Recipient',
            }),
          ],
        }),
      );

      if (!importResult.users?.length) {
        throw new Error('User not found on Telegram');
      }

      const user = importResult.users[0];
      await this.client.sendMessage(user.id, {
        message: options.message,
        parseMode: this.getParseMode(options.messageType),
      });

      return {
        success: true,
        userId: user.id.toString(),
        chatId: user.id.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to send to phone number ${options.phoneNumber}`,
        error,
      );
      throw error;
    }
  }

  private validateAttachments(
    options: TelegramSendOptions,
    type: string,
  ): void {
    if (!options.attachments?.length || !options.attachments[0]?.url) {
      throw new Error(
        `${type} message requires at least one attachment with URL`,
      );
    }
  }

  private getParseMode(
    messageType: TelegramMessageType,
  ): 'MarkdownV2' | 'HTML' | undefined {
    return messageType === TelegramMessageType.MARKDOWN
      ? 'MarkdownV2'
      : messageType === TelegramMessageType.HTML
        ? 'HTML'
        : undefined;
  }

  public getBots(): Map<string, TelegramBot> {
    return this.bots;
  }
}
