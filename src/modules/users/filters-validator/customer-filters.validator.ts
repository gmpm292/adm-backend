import {
  IsBooleanString,
  IsDateString,
  IsNumberString,
  IsString,
} from 'class-validator';

export class CustomerFiltersValidator {
  @IsNumberString()
  id: string;

  @IsDateString()
  createdAt: string;

  @IsString()
  name: string;

  @IsString()
  lastName: string;

  @IsString()
  role: string;

  @IsString()
  email: string;

  @IsString()
  mobile: string;

  @IsBooleanString()
  enabled: string;

  @IsNumberString()
  activePolicies: string;

  @IsNumberString()
  'office.id': string;

  @IsNumberString()
  'department.id': string;

  @IsNumberString()
  'team.id': string;
}
