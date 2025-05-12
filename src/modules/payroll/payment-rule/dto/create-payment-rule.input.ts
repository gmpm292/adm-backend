import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Length,
} from 'class-validator';
import { PaymentType } from '../enums/payment-type.enum';
import { Type } from 'class-transformer';
import { WorkerType } from '../../worker/enums/worker-type.enum';
import { ConditionsInput } from './conditions/conditions-input.dto';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

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

  @IsEnum(WorkerType)
  @IsOptional()
  workerType?: WorkerType;
}
