import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Length,
  MaxLength,
  MinLength,
  IsInt,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { PaymentType } from '../enums/payment-type.enum';
import { Type } from 'class-transformer';
import { WorkerType } from '../../worker/enums/worker-type.enum';
import { ConditionsInput } from './conditions/conditions-input.dto';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

export class CreatePaymentRuleInput extends CreateSecurityBaseInput {
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => ConditionsInput)
  conditions: ConditionsInput;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @IsInt({ each: true })
  specificWorkersIds?: number[];

  @IsEnum(WorkerType)
  @IsOptional()
  workerType?: WorkerType;

  @IsString()
  @IsOptional()
  otherType?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsString()
  @MaxLength(3)
  @MinLength(3)
  paymentCurrency: string;

  @IsEnum(ScopedAccessEnum)
  scope: ScopedAccessEnum;

  @IsBoolean()
  distributeProfits: boolean;
}
