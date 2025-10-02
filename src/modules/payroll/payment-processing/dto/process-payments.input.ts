import { IsInt, IsBoolean, IsOptional, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessPaymentsInput {
  @IsInt()
  @Min(1)
  payrollPeriodId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  businessId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  officeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  teamId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  workerIds?: number[];

  @IsOptional()
  @IsBoolean()
  force?: boolean = false;
}
