/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsObject,
  IsEnum,
  ArrayMinSize,
  ValidateIf,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TelegramMessageType } from '../enums/telegram-message-type.enum';
import { TelegramAttachmentInput } from './telegram-attachment.input';

export class TelegramRecipientInput {
  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class SendTelegramMessageInput {
  @ValidateIf((o) => !o.phoneNumber)
  @IsString()
  @IsNotEmpty({
    message: 'Chat ID is required when phoneNumber is not provided',
  })
  chatId?: string;

  @ValidateIf((o) => !o.chatId)
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'Phone number must be in international format (+1234567890)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelegramRecipientInput)
  recipients?: TelegramRecipientInput[];

  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.templateId)
  @IsNotEmpty({
    message: 'Message content is required when templateId is not provided',
  })
  message?: string;

  @IsOptional()
  @IsEnum(TelegramMessageType)
  messageType: TelegramMessageType = TelegramMessageType.TEXT;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, {
    groups: ['photo', 'document'],
    message: 'At least one attachment is required for photo/document messages',
  })
  @Type(() => TelegramAttachmentInput)
  attachments?: TelegramAttachmentInput[];

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsString()
  botTokenKey: string = 'default';

  @IsOptional()
  @IsString()
  templateId?: string;

  constructor() {
    // Validación condicional para tipos de mensaje que requieren adjuntos
    if (
      this.messageType === TelegramMessageType.PHOTO ||
      this.messageType === TelegramMessageType.DOCUMENT
    ) {
      this.attachments = this.attachments || [];
    }
  }
}
