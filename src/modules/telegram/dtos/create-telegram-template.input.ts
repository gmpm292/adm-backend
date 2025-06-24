import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsObject,
  IsBoolean,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { TelegramMessageType } from '../enums/telegram-message-type.enum';

export class CreateTelegramTemplateInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, {
    message: 'El nombre de la plantilla no puede exceder los 100 caracteres',
  })
  name: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(TelegramMessageType, {
    message: `El tipo de mensaje debe ser uno de: ${Object.values(TelegramMessageType).join(', ')}`,
  })
  messageType: TelegramMessageType = TelegramMessageType.TEXT;

  @IsObject()
  @IsOptional()
  defaultContext?: Record<string, any>;

  @IsBoolean()
  isActive: boolean = true;
}
