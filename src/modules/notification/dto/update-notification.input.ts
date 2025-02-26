import { PartialType } from '@nestjs/mapped-types';

import { CreateNotificationInput } from './create-notification.input';

export class UpdateNotificationInput extends PartialType(
  CreateNotificationInput,
) {
  id: number;
}
