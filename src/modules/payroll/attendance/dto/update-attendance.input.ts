import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceInput } from './create-attendance.input';
import { IsInt, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAttendanceInput extends PartialType(CreateAttendanceInput) {
  @IsInt()
  id: number;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;
}
