import {
  IsBooleanString,
  IsIn,
  IsNumberString,
  IsString,
} from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export class AttendanceFiltersValidator extends BaseFiltersValidator {
  @IsString()
  attendanceDate: string;

  @IsIn(Object.values(AttendanceStatus))
  status: string;

  @IsBooleanString()
  isPaid: string;

  @IsNumberString()
  'worker.id': string;

  @IsString()
  'worker.tempFirstName': string;

  @IsString()
  'worker.tempLastName': string;

  @IsString()
  'user.name': string;

  @IsString()
  'user.lastName': string;

  @IsString()
  'office.name': string;

  @IsNumberString()
  'office.id': string;

  @IsString()
  'business.name': string;

  @IsString()
  notes: string;
}
