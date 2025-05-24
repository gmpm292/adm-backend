import { IsEnum, IsNumberString, IsString } from 'class-validator';
import { DepartmentType } from '../enums/department-type.enum';

export class DepartmentFiltersValidator {
  @IsString()
  name: string;

  @IsEnum(DepartmentType)
  departmentType: string;

  @IsNumberString()
  'office.id': string;

  @IsNumberString()
  'officeId': string;

  @IsString()
  'office.name': string;

  @IsString()
  address: string;
}
