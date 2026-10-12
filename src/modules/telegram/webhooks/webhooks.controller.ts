/* eslint-disable @typescript-eslint/require-await */
import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { TelegramWebhooksService } from './webhooks.service';
import { ConfigService } from '../../../common/config';

@Controller('telegram/webhooks')
export class TelegramWebhooksController {
  constructor(
    private readonly webhooksService: TelegramWebhooksService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Punto de entrada de Telegram (REST, fuera de GraphQL) para cada bot.
   * Si hay `TELEGRAM_SECRET_TOKEN`, Telegram lo manda en la cabecera
   * `X-Telegram-Bot-Api-Secret-Token` (se registra con él en `setWebHook`);
   * sin ella, o con otro valor, se rechaza el update.
   */
  @Post(':botName')
  async handleWebhook(
    @Param('botName') botName: string,
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string,
  ) {
    const secretToken = this.configService.get<string>('TELEGRAM_SECRET_TOKEN');
    if (secretToken && !this.sameSecret(secretHeader, secretToken)) {
      throw new UnauthorizedException('Invalid Telegram secret token');
    }
    return this.webhooksService.handleUpdate(botName, update);
  }

  private sameSecret(received: string | undefined, expected: string): boolean {
    if (!received) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
