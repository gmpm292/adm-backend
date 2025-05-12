import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkScheduleInput } from './create-work-schedule.input';
import { IsNumber } from 'class-validator';

export class UpdateWorkScheduleInput extends PartialType(
  CreateWorkScheduleInput,
) {
  @IsNumber()
  id: number;
}
