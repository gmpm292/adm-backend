import {
  IsDate,
  IsOptional,
  IsObject,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * Semana (o tramo) de trabajo de una oficina: qué días se trabaja.
 * Example: {
 *   name: "Semana 41 - 2026",
 *   startDate: "2026-10-05",
 *   endDate: "2026-10-11",
 *   workingDays: { monday: true, ..., sunday: false },
 *   notes: "Semana con feriado el miércoles"
 * }
 */
export class CreateWorkScheduleInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 100)
  name: string;

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
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
