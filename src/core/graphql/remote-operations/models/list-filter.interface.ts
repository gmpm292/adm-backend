import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ConditionalOperator } from '../enums/conditional-operation.enum';
import { LogicalOperator } from '../enums/logical-operator.enum';
import { Type } from 'class-transformer';
import { CheckIsIsoUTCDate } from '../../../validations/check-iso-utc';

export class ListFilter {
  /**
   * Entity's field who is the target in the filter
   */
  @IsOptional()
  @IsString()
  property: string;

  /**
   * Operator to use in the comparison
   */
  @IsOptional()
  @IsEnum(ConditionalOperator)
  operator: ConditionalOperator;

  /**
   * Value to use in the comparison
   */
  @IsOptional()
  @CheckIsIsoUTCDate()
  value: string;

  /**
   * Operator to use in the comparison 'AND' or 'OR'
   */
  @IsOptional()
  @IsEnum(LogicalOperator)
  logicalOperator?: LogicalOperator;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ListFilter)
  filters?: ListFilter[];

  /**
   * Value to make a primary query with the principal filters
   * and a secondary one with the others.
   * The secondary query works on the result of the primary one.
   */
  principal?: boolean;
}
