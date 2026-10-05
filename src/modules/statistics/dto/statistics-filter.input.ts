import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class StatisticsFilterInput {
  @Matches(CALENDAR_DATE)
  dateFrom: string;

  @Matches(CALENDAR_DATE)
  dateTo: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(-840)
  @Max(840)
  utcOffsetMinutes?: number;

  @IsOptional()
  @IsInt()
  businessId?: number;

  @IsOptional()
  @IsInt()
  officeId?: number;
}
