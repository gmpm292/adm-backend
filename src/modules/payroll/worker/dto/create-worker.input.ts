import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsPositive,
  IsInt,
  IsEmail,
  IsPhoneNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkerType } from '../enums/worker-type.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateWorkerInput extends CreateSecurityBaseInput {
  /** Cuenta de usuario ya existente que se vincula (opcional) */
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number | null;

  @IsEnum(WorkerType)
  workerType: WorkerType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  otherType?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  paymentRuleId?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El salario base no puede ser negativo' })
  baseSalary?: number;

  @IsOptional()
  customPaymentSettings?: Record<string, unknown>;

  // Datos propios del trabajador (las columnas conservan el nombre `temp*`)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tempFirstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tempLastName?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  tempEmail?: string | null;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message:
      'El teléfono debe llevar el código del país, por ejemplo +5351234567',
  })
  tempPhone?: string | null;
}
