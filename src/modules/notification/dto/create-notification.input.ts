import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationTypeEnum } from '../enums/notification-types.enumn';

export class CreateNotificationInput {
  @IsString()
  tipo: string | NotificationTypeEnum;

  @IsString()
  titulo: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: Array<string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  officeIds?: Array<string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: Array<string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: Array<string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: Array<string>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
