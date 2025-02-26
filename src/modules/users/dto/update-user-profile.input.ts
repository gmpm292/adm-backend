import { PartialType } from '@nestjs/mapped-types';

import { CreateUserInput } from './create-user.input';

export class UpdateUserProfileInput extends PartialType(CreateUserInput) {}
