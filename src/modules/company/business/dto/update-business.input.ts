import { PartialType } from '@nestjs/mapped-types';
import { CreateBusinessInput } from './create-business.input';

export class UpdateBusinessInput extends PartialType(CreateBusinessInput) {
  id: number;
}
