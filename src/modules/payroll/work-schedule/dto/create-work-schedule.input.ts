import { IsDate, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { Role } from '../../../../core/enums/role.enum';

/**
 * DTO for creating a work schedule
 * Example: {
 *   startDate: "2024-06-01",
 *   endDate: "2024-06-07",
 *   workingDays: {
 *     monday: true,
 *     tuesday: true,
 *     wednesday: false,
 *     thursday: true,
 *     friday: true,
 *     saturday: false,
 *     sunday: false
 *   },
 *   notes: "Semana con feriado el miércoles"
 * }
 */
export class CreateWorkScheduleInput extends CreateSecurityBaseInput {
  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsObject()
  workingDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  notes?: string;
}
