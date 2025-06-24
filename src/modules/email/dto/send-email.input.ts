/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { EmailAttachmentInput } from './email-attachment.input';

export class SendEmailInput {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => !o.templateId)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => !o.templateId)
  body?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsEmail()
  @IsOptional()
  cc?: string;

  @IsEmail()
  @IsOptional()
  bcc?: string;

  @IsOptional()
  attachments?: EmailAttachmentInput[];

  @IsObject()
  @IsOptional()
  context?: Record<string, any>;
}
