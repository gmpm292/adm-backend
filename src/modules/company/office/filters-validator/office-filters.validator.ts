import { IsDateString, IsEnum, IsString } from 'class-validator';
import { OfficeType } from '../enums/office-type.enum';

export class OfficeFiltersValidator {
  @IsString()
  name: string;

  @IsEnum(OfficeType)
  officeType: string;

  @IsDateString()
  deletedAt: string;

  @IsString()
  'business.id': string;

  @IsString()
  'businessId': string;

  @IsString()
  'business.name': string;

  @IsString()
  address: string;
}
