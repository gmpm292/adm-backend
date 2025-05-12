import { PartialType } from '@nestjs/mapped-types';

import { CreateTeamInput } from './create-team.input';

export class UpdateTeamInput extends PartialType(CreateTeamInput) {
  id: number;
}
