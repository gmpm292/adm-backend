import { PartialType } from '@nestjs/mapped-types';
import { CreateScopedAccessInput } from './create-scoped-access.input';

export class UpdateScopedAccessInput extends PartialType(
  CreateScopedAccessInput,
) {
  id: number;
}
