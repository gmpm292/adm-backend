import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';

/**
 * Base de las conversaciones de varios pasos con un bot. Cada pregunta lleva
 * el prefijo `(FLOW_PREFIX)` para reconocer a qué flujo responde el usuario.
 */
@Injectable()
export abstract class ConversationFlow {
  protected abstract readonly FLOW_PREFIX: string;

  /** Prefijo de las preguntas del flujo; hoy no usa `step`. */
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
