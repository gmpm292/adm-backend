import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { TeamTypeEnum } from '../enums/team-types.enum';

export class CreateTeamInput {
  @IsEnum(TeamTypeEnum)
  teamType: TeamTypeEnum;

  @IsPositive()
  @IsInt()
  departmentId: number;
}
