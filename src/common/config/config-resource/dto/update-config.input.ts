import { PartialType } from '@nestjs/mapped-types';

import { CreateConfigInput } from './create-config.input';

export class UpdateConfigInput extends PartialType(CreateConfigInput) {
  id: number;
}
