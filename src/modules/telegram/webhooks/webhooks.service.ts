/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramTransportService } from '../services/telegram-transport.service';
import { StartCommand } from './commands/start.command';
import { HelpCommand } from './commands/help.command';
import { RegularMessage } from './commands/regular-message';
import { RegisterCommand } from './commands/register.command';

@Injectable()
export class TelegramWebhooksService {
  private bots: Map<string, TelegramBot>;
  private readonly logger = new Logger(TelegramWebhooksService.name);

  constructor(
    private readonly transportService: TelegramTransportService,
    private readonly startCommand: StartCommand,
    private readonly helpCommand: HelpCommand,
    private readonly registerCommand: RegisterCommand,
    private readonly regularMessage: RegularMessage,
  ) {}

  async init(): Promise<void> {
    try {
      this.bots = this.transportService.getBots();
      this.setupMessageHandlers();
      this.logger.log('Handlers de Telegram configurados correctamente');
    } catch (error) {
      this.logger.error(
        `Error al inicializar TelegramWebhooksService: ${error.message}`,
      );
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    this.bots.forEach((bot, botName) => {
      try {
        // handle Phone Contact
        bot.on('contact', (msg) => {
          if (msg.contact && msg.from?.id === msg.contact.user_id) {
            void this.registerCommand.handleContact(bot, msg);
          }
        });

        // Comandos
        bot.onText(/\/start/, (msg) => this.startCommand.execute(bot, msg));
        bot.onText(/\/help/, (msg) => this.helpCommand.execute(bot, msg));
        bot.onText(/\/register/, (msg) =>
          this.registerCommand.execute(bot, msg),
        );

        // Manejar respuestas
        bot.on('message', (msg) => {
          if (msg.reply_to_message) {
            this.registerCommand
              .handleReply(bot, msg)
              .catch((err) =>
                this.logger.error(`Error al manejar reply: ${err.message}`),
              );
          }
        });

        // Mensajes regulares
        bot.on('message', (msg) => {
          if (!msg.text?.startsWith('/')) {
            this.regularMessage
              .execute(bot, msg)
              .catch((err) =>
                this.logger.error(
                  `Error al manejar mensaje regular: ${err.message}`,
                ),
              );
          }
        });

        this.logger.log(`Handlers configurados para bot: ${botName}`);
      } catch (error) {
        this.logger.error(
          `Error al configurar handlers para bot ${botName}: ${error.message}`,
        );
      }
    });
  }

  handleUpdate(botName: string, update: TelegramBot.Update): void {
    const bot = this.bots.get(botName);
    if (!bot) {
      this.logger.error(`Bot ${botName} no encontrado para procesar update`);
      return;
    }

    try {
      bot.processUpdate(update);
      this.logger.debug(`Update procesado para ${botName}`);
    } catch (error) {
      this.logger.error(
        `Error al procesar update para ${botName}: ${error.message}`,
      );
    }
  }
}
