/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'exclusiveAmountPercentage', async: false })
export class ExclusiveAmountPercentageConstraint
  implements ValidatorConstraintInterface
{
  validate(object: any) {
    const hasAmount = object.amount !== undefined && object.amount !== null;
    const hasPercentage =
      object.percentage !== undefined && object.percentage !== null;

    // Solo uno debe estar definido.
    return !(hasAmount && hasPercentage);
  }

  defaultMessage() {
    return 'Los campos amount y percentage son mutuamente excluyentes. Solo uno debe ser definido.';
  }
}

export class PriceRangeConditionInput {
  @IsNumber()
  @IsInt()
  min: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  max?: number | null;

  @IsString()
  @MaxLength(3)
  @MinLength(3)
  currency: string;

  @ValidateIf((o) => o.percentage === undefined)
  @IsNumber()
  amount: number;

  @ValidateIf((o) => o.amount === undefined)
  @IsNumber()
  percentage: number;

  @Validate(ExclusiveAmountPercentageConstraint)
  validateExclusivity: boolean;
}
