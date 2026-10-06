import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleDetailInput } from './create-sale.input';
import { MakeSalePaymentInput } from './make-sale.input';

export class QuoteSaleInput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleDetailInput)
  details: SaleDetailInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MakeSalePaymentInput)
  payments?: MakeSalePaymentInput[];

  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;
}
