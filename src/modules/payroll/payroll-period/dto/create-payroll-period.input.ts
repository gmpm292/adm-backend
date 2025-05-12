import {
  IsDate,
  IsBoolean,
  IsString,
  IsOptional,
  Length,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreatePayrollPeriodInput extends CreateSecurityBaseInput {
  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;

  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
