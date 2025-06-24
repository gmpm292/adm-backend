import { PartialType } from '@nestjs/mapped-types';

import { IsString } from 'class-validator';
import { CreateTelegramTemplateInput } from './create-telegram-template.input';

export class UpdateTelegramTemplateInput extends PartialType(
  CreateTelegramTemplateInput,
) {
  @IsString()
  id: string;
}
