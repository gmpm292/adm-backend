/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramMessage } from './entities/telegram-message.entity';
import { TelegramTemplate } from './entities/telegram-template.entity';
import { TelegramService } from './services/telegram.service';
import { TelegramTransportService } from './services/telegram-transport.service';
import { TelegramResolver } from './resolvers/telegram.resolver';

import { User } from '../users/entities/user.entity';
import { ConfigModule } from '../../common/config';
import { TelegramWebhooksController } from './webhooks/webhooks.controller';
import { TelegramWebhooksService } from './webhooks/webhooks.service';
import { StartCommand } from './webhooks/commands/start.command';
import { HelpCommand } from './webhooks/commands/help.command';
import { RegularMessage } from './webhooks/commands/regular-message';
import { RegisterCommand } from './webhooks/commands/register.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramMessage, TelegramTemplate, User]),
    ConfigModule,
  ],
  controllers: [TelegramWebhooksController],
  providers: [
    TelegramService,
    TelegramTransportService,
    TelegramResolver,
    TelegramWebhooksService,
    StartCommand,
    HelpCommand,
    RegisterCommand,
    RegularMessage,
  ],
  exports: [TelegramService, TelegramWebhooksService],
})
export class TelegramModule implements OnModuleInit {
  private readonly logger = new Logger(TelegramModule.name);

  constructor(
    private readonly telegramTransportService: TelegramTransportService,
    private readonly telegramWebhooksService: TelegramWebhooksService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing Telegram module...');

      await this.telegramTransportService.init();

      await this.telegramWebhooksService.init();

      this.logger.log('Telegram module initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Telegram module', error.stack);
      throw error;
    }
  }
}
