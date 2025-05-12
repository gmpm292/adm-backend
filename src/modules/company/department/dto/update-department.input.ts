import { PartialType } from '@nestjs/mapped-types';

import { CreateDepartmentInput } from './create-department.input';

export class UpdateDepartmentInput extends PartialType(CreateDepartmentInput) {
  id: number;
}
