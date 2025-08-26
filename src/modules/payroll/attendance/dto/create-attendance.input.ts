import {
  IsDate,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export class CreateAttendanceInput extends CreateSecurityBaseInput {
  @IsNumber()
  workerId: number;

  @IsDate()
  attendanceDate: Date;

  @IsString()
  @IsOptional()
  checkInTime?: string;

  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsNumber()
  @IsOptional()
  hoursWorked?: number;

  @IsNumber()
  @IsOptional()
  workScheduleId?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isHoliday?: boolean;
}
