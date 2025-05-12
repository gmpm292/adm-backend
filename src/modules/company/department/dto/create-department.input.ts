import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { DepartmentType } from '../enums/department-type.enum';

export class CreateDepartmentInput {
  @IsEnum(DepartmentType)
  departmentType: DepartmentType;

  @IsPositive()
  @IsInt()
  officeId: number;

  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
