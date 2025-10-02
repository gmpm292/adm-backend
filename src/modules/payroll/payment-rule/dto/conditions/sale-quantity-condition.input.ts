/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsInt,
  IsNumber,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'exclusiveRateFields', async: false })
export class ExclusiveRateFieldsConstraint
  implements ValidatorConstraintInterface
{
  validate(object: any) {
    const hasRate =
      object.ratePerProduct !== undefined && object.ratePerProduct !== null;
    const hasPercentage =
      object.percentagePerProduct !== undefined &&
      object.percentagePerProduct !== null;

    // Solo uno debe estar definido.
    return !(hasRate && hasPercentage);
  }

  defaultMessage() {
    return 'Los campos ratePerProduct y percentagePerProduct son mutuamente excluyentes. Solo uno debe ser definido.';
  }
}

export class SaleQuantityConditionInput {
  @IsNumber()
  @IsInt()
  minProducts: number;

  @ValidateIf((o) => o.percentagePerProduct === undefined)
  @IsNumber()
  ratePerProduct: number;

  @ValidateIf((o) => o.ratePerProduct === undefined)
  @IsNumber()
  percentagePerProduct?: number;

  @Validate(ExclusiveRateFieldsConstraint)
  validateExclusivity: boolean;
}
