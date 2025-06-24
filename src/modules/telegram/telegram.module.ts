import { Module } from '@nestjs/common';
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
  ],
  exports: [TelegramService, TelegramWebhooksService],
})
export class TelegramModule {}
