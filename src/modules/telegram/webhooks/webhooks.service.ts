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
        // Manejar contactos compartidos
        bot.on('contact', (msg) => {
          if (msg.contact && msg.from?.id === msg.contact.user_id) {
            void this.registerCommand.handleContact(bot, msg);
          }
        });
        // Manejar callbacks de botones
        bot.on('callback_query', async (callbackQuery) => {
          const msg = callbackQuery.message;
          const chatId = msg?.chat.id;
          const data = callbackQuery.data;

          if (!chatId || !data) return;

          try {
            // Manejar confirmación de registro
            if (data.startsWith('confirm_')) {
              await this.registerCommand.handleConfirmation(chatId, data, bot);
            }

            // Responder al callback para quitar el "cargando" del botón
            await bot.answerCallbackQuery(callbackQuery.id);
          } catch (error) {
            this.logger.error(`Error al manejar callback: ${error.message}`);
          }
        });

        // Comandos directos
        bot.onText(/\/start/, (msg) => this.startCommand.execute(bot, msg));
        bot.onText(/\/help/, (msg) => this.helpCommand.execute(bot, msg));
        bot.onText(/\/register/, (msg) =>
          this.registerCommand.execute(bot, msg),
        );

        // Manejar respuestas a mensajes del sistema
        bot.on('message', (msg) => {
          if (!msg.reply_to_message?.text) return;

          if (this.registerCommand.isFlowMessage(msg.reply_to_message.text)) {
            this.registerCommand
              .handleReply(bot, msg)
              .catch((err) =>
                this.logger.error(`Error al manejar reply: ${err.message}`),
              );
          }
        });

        // Mensajes regulares
        bot.on('message', (msg) => {
          if (
            !msg.text?.startsWith('/') &&
            !msg.reply_to_message?.text &&
            !/^\(.{2,5}\).*$/.test(msg.reply_to_message?.text || '')
          ) {
            const a =
              msg.reply_to_message?.text &&
              /^\(.{2,5}\).*$/.test(msg.reply_to_message.text);
            console.log('a', a);
            this.regularMessage
              .execute(bot, msg)
              .catch((err) =>
                this.logger.error(
                  `Error al manejar mensaje regular: ${err.message}`,
                ),
              );
          }
        });
        // // Mensajes regulares
        // bot.on('message', (msg) => {
        //   // Verificar si es un mensaje de respuesta (reply) y cumple con el patrón
        //   if (
        //     msg.reply_to_message?.text &&
        //     /^\(.{2,5}\).*$/.test(msg.reply_to_message.text)
        //   ) {
        //     this.regularMessage
        //       .execute(bot, msg)
        //       .catch((err) =>
        //         this.logger.error(
        //           `Error al manejar mensaje regular: ${err.message}`,
        //         ),
        //       );
        //   }
        // });

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
