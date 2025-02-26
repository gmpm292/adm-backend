import { IsDateString, IsString } from 'class-validator';

export class BaseFiltersValidator {
  @IsString()
  id: string;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  deletedAt: string;

  @IsDateString()
  updatedAt: string;
}
