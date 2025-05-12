import { IsInt, IsOptional } from 'class-validator';

export class CreateSecurityBaseInput {
  @IsOptional()
  @IsInt()
  businessId?: number;

  @IsOptional()
  @IsInt()
  officeId?: number;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  teamId?: number;
}
