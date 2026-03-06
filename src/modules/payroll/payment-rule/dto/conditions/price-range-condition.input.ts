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
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'exclusiveAmountPercentage', async: false })
export class ExclusiveAmountPercentageConstraint
  implements ValidatorConstraintInterface
{
  validate(_: any, args: ValidationArguments) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const object = args.object as any;

    const hasAmount = object.amount !== undefined && object.amount !== null;
    const hasPercentage =
      object.percentage !== undefined && object.percentage !== null;

    // ❗ Solo uno debe existir
    return !(hasAmount && hasPercentage);
  }
  defaultMessage() {
    return 'Los campos amount y percentage son mutuamente excluyentes. Solo uno debe ser definido.';
  }
}

export class PriceRangeConditionInput {
  @IsNumber()
  min: number;

  @IsOptional()
  @IsNumber()
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
