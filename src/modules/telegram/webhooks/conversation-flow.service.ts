import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';

@Injectable()
export abstract class ConversationFlow {
  protected abstract readonly FLOW_PREFIX: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateMessageId(step: string): string {
    return `(${this.FLOW_PREFIX})`;
  }

  isFlowMessage(text?: string): boolean {
    const result = text?.startsWith(`(${this.FLOW_PREFIX})`) || false;
    return result;
  }

  abstract handleReply(bot: TelegramBot, msg: Message): Promise<void>;
}
