import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduledTaskInput } from './create-scheduled-task.input';

export class UpdateScheduledTaskInput extends PartialType(
  CreateScheduledTaskInput,
) {
  id: number;
}
