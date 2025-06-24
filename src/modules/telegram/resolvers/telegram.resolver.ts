import { Resolver, Args, Mutation, Query } from '@nestjs/graphql';
import { TelegramService } from '../services/telegram.service';
import { TelegramMessage } from '../entities/telegram-message.entity';
import { TelegramTemplate } from '../entities/telegram-template.entity';

import { UseGuards } from '@nestjs/common';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { SendTelegramMessageInput } from '../dtos/send-telegram-message.input';
import { CreateTelegramTemplateInput } from '../dtos/create-telegram-template.input';
import { TelegramStatsOutput } from '../dtos/telegram-stats.output';
@Resolver()
export class TelegramResolver {
  constructor(private readonly telegramService: TelegramService) {}

  @Roles(Role.SUPER)
  @Query('telegramMessages')
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  async getTelegramMessages(): Promise<TelegramMessage[]> {
    return this.telegramService.findAllMessages();
  }

  @Roles(Role.SUPER)
  @Mutation('sendTelegramMessage')
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  async sendMessage(
    @Args('input') input: SendTelegramMessageInput,
  ): Promise<TelegramMessage> {
    return this.telegramService.sendMessage(input);
  }

  @Roles(Role.SUPER)
  @Query('telegramTemplates')
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  async getTelegramTemplates(): Promise<TelegramTemplate[]> {
    return this.telegramService.findAllTemplates();
  }

  @Roles(Role.SUPER)
  @Mutation('createTelegramTemplate')
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  async createTemplate(
    @Args('input') input: CreateTelegramTemplateInput,
  ): Promise<TelegramTemplate> {
    return this.telegramService.createTemplate(input);
  }

  @Roles(Role.SUPER)
  @Query('telegramStats')
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  async getStats(): Promise<TelegramStatsOutput> {
    return this.telegramService.getStats();
  }
}
