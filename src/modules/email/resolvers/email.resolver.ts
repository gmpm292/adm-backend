/* eslint-disable @typescript-eslint/no-unused-vars */
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

import { SendEmailInput } from '../dto/send-email.input';
import { EmailService } from '../servises/email.service';
import { CreateEmailTemplateInput } from '../dto/create-email-template.input';
import { UpdateEmailTemplateInput } from '../dto/update-email-template.input';

@Resolver('Email')
export class EmailResolver {
  constructor(private readonly emailService: EmailService) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('emails')
  async findAllEmails(@CurrentUser() user: JWTPayload) {
    return this.emailService.findAll();
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('email')
  async findOneEmail(@CurrentUser() user: JWTPayload, @Args('id') id: string) {
    return this.emailService.findOne(id);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('emailTemplates')
  async findAllEmailTemplates(@CurrentUser() user: JWTPayload) {
    return this.emailService.findAllTemplates();
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('emailTemplate')
  async findOneEmailTemplate(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: string,
  ) {
    return this.emailService.findTemplateById(id);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('emailStats')
  async getEmailStats(@CurrentUser() user: JWTPayload) {
    return this.emailService.getStats();
  }

  @Mutation('sendEmail')
  async sendEmail(
    @CurrentUser() user: JWTPayload,
    @Args('input') input: SendEmailInput,
  ) {
    return this.emailService.sendEmail({
      ...input,
      context: { ...input.context, sentByUserId: user.sub },
    });
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createEmailTemplate')
  async createEmailTemplate(
    @CurrentUser() user: JWTPayload,
    @Args('input') input: CreateEmailTemplateInput,
  ) {
    return this.emailService.createTemplate(input);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateEmailTemplate')
  async updateEmailTemplate(
    @CurrentUser() user: JWTPayload,
    @Args('input') input: UpdateEmailTemplateInput,
  ) {
    return this.emailService.updateTemplate(input);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('retryFailedEmails')
  async retryFailedEmails(@CurrentUser() user: JWTPayload) {
    await this.emailService.retryFailedEmails();
    return true;
  }
}
