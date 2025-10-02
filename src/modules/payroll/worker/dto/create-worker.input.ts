import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsPositive,
  IsInt,
  IsEmail,
  IsPhoneNumber,
  IsArray,
} from 'class-validator';
import { WorkerType } from '../enums/worker-type.enum';
import { Role } from '../../../../core/enums/role.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateWorkerInput extends CreateSecurityBaseInput {
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;

  @IsString()
  @IsEnum(WorkerType)
  workerType: WorkerType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  paymentRuleId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  baseSalary?: number;

  @IsOptional()
  customPaymentSettings?: Record<string, unknown>;

  // Campos temporales para creación de usuario
  @IsOptional()
  @IsString()
  tempFirstName?: string;

  @IsOptional()
  @IsString()
  tempLastName?: string;

  @IsOptional()
  @IsEmail()
  tempEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  tempPhone?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  tempRole?: Role[];
}
