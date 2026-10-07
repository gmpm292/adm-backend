import {
  IsDate,
  IsString,
  IsOptional,
  Length,
  MaxLength,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/** Un período nace abierto; se cierra con `closePayrollPeriod` */
export class CreatePayrollPeriodInput extends CreateSecurityBaseInput {
  /** Inicio del primer día (en la zona del usuario) */
  @IsDate()
  startDate: Date;

  /** Final del último día (en la zona del usuario) */
  @IsDate()
  endDate: Date;

  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;
}
