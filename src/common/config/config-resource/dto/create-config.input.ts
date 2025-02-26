import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ConfigStatus } from '../enums/config-status.enum';
import { ConfigVisibility } from '../enums/config-visibility.enum';
import { ConfigCategory } from '../enums/config-category.enum';

export class CreateConfigInput {
  @IsEnum(ConfigCategory)
  @IsOptional()
  public category?: ConfigCategory;

  @IsString()
  public group: string;

  @IsString()
  @IsOptional()
  public description?: string;

  @IsObject()
  public values: Record<string, unknown>;

  @IsEnum(ConfigStatus)
  @IsOptional()
  public configStatus?: ConfigStatus;

  @IsEnum(ConfigVisibility)
  @IsOptional()
  public configVisibility?: ConfigVisibility;
}
