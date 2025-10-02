import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateScheduledTaskInput {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  handlerType: string;

  @IsString()
  cronExpression: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean; // Para identificar tareas por defecto, uso exclusivo del API
}
