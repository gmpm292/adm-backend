import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
} from 'typeorm';
import { User } from '../entities/user.entity';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  constructor(private readonly dataSource: DataSource) {}

  listenTo() {
    return User;
  }

  beforeUpdate(event: UpdateEvent<User>) {
    this.validateSystemUser(event);
  }

  beforeRemove(event: RemoveEvent<User>) {
    this.validateSystemUser(event);
  }

  beforeSoftRemove(event: SoftRemoveEvent<User>): Promise<any> | void {
    this.validateSystemUser(event);
  }

  private validateSystemUser(event: UpdateEvent<User> | RemoveEvent<User>) {
    if (
      event.entity &&
      'email' in event.entity &&
      event.entity.email === 'system@admin.com'
    ) {
      throw new ForbiddenResourceError('Cannot change system user');
    }
  }
}
