/* eslint-disable @typescript-eslint/require-await */
import { Controller, Post, Body, Param } from '@nestjs/common';
import { TelegramWebhooksService } from './webhooks.service';

@Controller('telegram/webhooks')
export class TelegramWebhooksController {
  constructor(private readonly webhooksService: TelegramWebhooksService) {}

  @Post(':botName')
  async handleWebhook(@Param('botName') botName: string, @Body() update: any) {
    return this.webhooksService.handleUpdate(botName, update);
  }
}
