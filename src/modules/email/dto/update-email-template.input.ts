import { PartialType } from '@nestjs/mapped-types';
import { CreateEmailTemplateInput } from './create-email-template.input';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateEmailTemplateInput extends PartialType(
  CreateEmailTemplateInput,
) {
  @IsString()
  @IsNotEmpty()
  id: string;
}
