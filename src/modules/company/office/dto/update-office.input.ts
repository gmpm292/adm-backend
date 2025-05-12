import { PartialType } from '@nestjs/mapped-types';
import { CreateOfficeInput } from './create-office.input';

export class UpdateOfficeInput extends PartialType(CreateOfficeInput) {
  id: number;
}
