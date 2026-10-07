import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceInput } from './create-attendance.input';
import { IsInt } from 'class-validator';

/**
 * `isPaid` no se edita aquí: se marca con `markAsPaid`, que comprueba que el
 * registro esté completo.
 */
export class UpdateAttendanceInput extends PartialType(CreateAttendanceInput) {
  @IsInt()
  id: number;
}
