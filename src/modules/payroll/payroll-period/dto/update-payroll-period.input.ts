import { PartialType } from '@nestjs/mapped-types';
import { CreatePayrollPeriodInput } from './create-payroll-period.input';
import { IsInt } from 'class-validator';

export class UpdatePayrollPeriodInput extends PartialType(
  CreatePayrollPeriodInput,
) {
  @IsInt()
  id: number;
}
