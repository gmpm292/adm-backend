/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';

@Injectable()
export class RegularMessage {
  private readonly logger = new Logger(RegularMessage.name);

  private readonly responses = [
    '¡Hola {name}! 🌟 Recibí tu mensaje: "{text}"',
    '✨ ¡Gracias por escribir, {name}! Tu mensaje: "{text}" está siendo procesado',
    '👋 {name}, leíste mi mente... justo pensaba en "{text}"',
    '📬 Mensaje recibido: "{text}" - ¡Gracias por compartir, {name}!',
    '💫 {name}, tu mensaje: "{text}" ha llegado a buen destino',
  ];

  private getRandomResponse(): string {
    return this.responses[Math.floor(Math.random() * this.responses.length)];
  }

  async execute(bot: TelegramBot, msg: Message): Promise<void> {
    try {
      const userName = msg.from?.first_name || 'amigo/a';
      const userText = msg.text || 'mensaje sin texto';

      const response = this.getRandomResponse()
        .replace('{name}', userName)
        .replace('{text}', userText);

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });

      this.logger.log(
        `Respuesta enviada a ${userName} para el mensaje: "${userText}"`,
      );
    } catch (error) {
      this.logger.error(`Error al procesar mensaje regular: ${error.message}`);
      await bot.sendMessage(
        msg.chat.id,
        '¡Ups! Algo mágico salió mal... pero ya lo estoy solucionando ✨',
      );
    }
  }
}
