/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { StartCommand } from './commands/start.command';
import { HelpCommand } from './commands/help.command';
import { TelegramTransportService } from '../services/telegram-transport.service';

@Injectable()
export class TelegramWebhooksService {
  private bots: Map<string, TelegramBot>;
  private readonly logger = new Logger(TelegramWebhooksService.name);

  constructor(
    private readonly transportService: TelegramTransportService,
    private readonly startCommand: StartCommand,
    private readonly helpCommand: HelpCommand,
  ) {
    this.bots = transportService.getBots(); // Método getter para acceder a los bots
    this.setupCommands();
  }

  private setupCommands(): void {
    this.bots.forEach((bot, botName) => {
      bot.onText(/^\/start$/, async (msg) => {
        try {
          await this.startCommand.execute(bot, msg);
        } catch (error) {
          console.error(`Error handling /start command: ${error}`);
        }
      });
      //bot.onText(/\/start/, (msg) => this.startCommand.execute(bot, msg));
      //bot.onText(/\/help/, (msg) => this.helpCommand.execute(bot, msg));
    });
  }

  handleUpdate(botName: string, update: any) {
    //throw new Error('Method not implemented.');
    const bot = this.bots.get(botName);
    if (!bot) {
      this.logger.error(`Bot ${botName} no encontrado`);
      return;
    }

    // Procesa el update con el bot (esto disparará los listeners como onText)
    bot.processUpdate(update);

    // Opcional: Registra el update en logs
    this.logger.debug(
      `Update recibido para ${botName}: ${JSON.stringify(update)}`,
    );
  }
}
