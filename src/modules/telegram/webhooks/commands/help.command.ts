/* eslint-disable @typescript-eslint/no-floating-promises */
import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';

@Injectable()
export class HelpCommand {
  execute(bot: TelegramBot, msg: Message): void {
    bot.sendMessage(msg.chat.id, '¡Help!');
  }
}
