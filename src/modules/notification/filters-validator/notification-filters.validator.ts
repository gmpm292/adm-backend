import { IsDateString, IsString } from 'class-validator';

export class NotificationFiltersValidator {
  @IsDateString()
  createdAt: string;

  @IsString()
  titulo: string;

  @IsString()
  message: string;

  @IsString()
  tipo: string;

  @IsString()
  status: string;

  @IsDateString()
  sentAt: string;
}
