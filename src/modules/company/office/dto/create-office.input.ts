import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { OfficeType } from '../enums/office-type.enum';

export class CreateOfficeInput {
  @IsInt()
  businessId: number;

  @IsEnum(OfficeType)
  officeType: OfficeType;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  address: string;
}
