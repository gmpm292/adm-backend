import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class GlobalSearchInput {
  @IsInt()
  leadSkip: number;

  @IsPositive()
  @IsInt()
  leadTake: number;

  @IsInt()
  customerSkip: number;

  @IsPositive()
  @IsInt()
  customerTake: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  emailSearch?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  phoneSearch?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;
}
