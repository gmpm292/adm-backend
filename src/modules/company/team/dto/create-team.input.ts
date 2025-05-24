import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { TeamTypeEnum } from '../enums/team-types.enum';

export class CreateTeamInput {
  @IsEnum(TeamTypeEnum)
  teamType: TeamTypeEnum;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsPositive()
  @IsInt()
  departmentId: number;
}
