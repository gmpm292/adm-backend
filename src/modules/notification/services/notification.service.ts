/* eslint-disable @typescript-eslint/no-floating-promises */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, FindOptionsWhere, Repository } from 'typeorm';
import { CreateNotificationInput } from '../dto/create-notification.input';
import { UpdateNotificationInput } from '../dto/update-notification.input';

import { NotificationLogService } from './notification-log.service';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { BaseService } from '../../../core/services/base.service';
import { Notification } from '../entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../../core/enums/role.enum';
import { NotificationLog } from '../entities/notification-log.entity';
import {
  ListFilter,
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { NotFoundError } from '../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { AppEventService } from '../../events/services/app-event.service';

@Injectable()
export class NotificationService extends BaseService<Notification> {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly notificationLogService: NotificationLogService,
    private readonly appEventService: AppEventService,
  ) {
    super(notificationRepository);
  }

  async create(
    currentUser: JWTPayload | false,
    createNotificationInput: CreateNotificationInput,
  ): Promise<Notification> {
    if (!currentUser) {
      const u = await this.userRepository.findOne({
        where: { role: ArrayContains([Role.SUPER]) },
      });
      currentUser = { sub: u?.id, role: u?.role } as JWTPayload;
    }
    const users = await this.findUsers(createNotificationInput);
    const { titulo, tipo, message, metadata } = createNotificationInput;
    const notification = await super.baseCreate({
      data: {
        titulo,
        tipo,
        message,
        metadata,
        createdBy: { id: currentUser.sub } as User,
      },
    });
    for (const user of users) {
      const notificationLog: NotificationLog = {
        read: false,
        erased: false,
        user,
        notification,
      };
      await this.notificationLogService.create(notificationLog);
    }
    return notification;
  }

  async find(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListSummary> {
    if (!currentUser.role.some((r) => r === Role.SUPER)) {
      if (!options || !options.filters) {
        options = { ...options, filters: [] } as ListOptions;
      }
      options.filters?.push({
        property: 'createdBy.id',
        operator: ConditionalOperator.EQUAL,
        value: currentUser.sub.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    }

    const notifications = await this.baseFind({
      options,
      relationsToLoad: [
        'notificationLogs',
        'notificationLogs.user',
        'createdBy',
        'createdBy.office',
        'createdBy.department',
        'createdBy.team',
        'sentBy',
      ],
    });
    notifications.data = (notifications.data as Array<Notification>).map(
      (n) => {
        n['users'] = n.notificationLogs.map((nl) => nl.user);
        return n;
      },
    );
    return notifications;

    /* TODO QUITAR if (
      !currentUser.role.some((r) => r === Role.SUPER || r === Role.PRINCIPAL)
    ) {
      if (!options || !options.filters) {
        options = { ...options, filters: [] } as ListOptions;
      }
      options.filters.push({
        property: 'notification.createById',
        operator: ConditionalOperator.EQUAL,
        value: currentUser.sub.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    }

    const notificationLogs = await this.notificationLogService.baseFind(
      options,
      ['notification'],
    );

    notificationLogs.data = (
      notificationLogs.data as Array<NotificationLog>
    ).map((n) => n.notification);

    return notificationLogs; */
  }

  async findClientNotification(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListSummary> {
    if (!options || !options.filters) {
      options = { ...options, filters: [] } as ListOptions;
    }
    options.filters?.push({
      property: 'user.id',
      operator: ConditionalOperator.EQUAL,
      value: currentUser.sub.toString(),
      logicalOperator: LogicalOperator.AND,
    } as ListFilter);
    options.filters?.push({
      property: 'notification.status',
      operator: ConditionalOperator.EQUAL,
      value: 'sent',
      logicalOperator: LogicalOperator.AND,
    } as ListFilter);
    options.filters?.push({
      property: 'erased',
      operator: ConditionalOperator.EQUAL,
      value: 'false',
      logicalOperator: LogicalOperator.AND,
    } as ListFilter);

    const notificationLogs = await this.notificationLogService.baseFind({
      options,
      relationsToLoad: ['notification', 'user'],
    });

    /* notificationLogs.data = (
      notificationLogs.data as Array<NotificationLog>
    ).map((n) => n.notification); */

    return notificationLogs;
  }

  async findOne(id: number): Promise<Notification> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        notificationLogs: { user: true },
        createdBy: true,
        sentBy: true,
      },
    });
  }
  async findOneByFilters(
    filters: FindOptionsWhere<Notification>,
  ): Promise<Notification> {
    return super.baseFindOneByFilters({
      filters,
      relationsToLoad: {
        notificationLogs: { user: true },
        createdBy: true,
        sentBy: true,
      },
    });
  }

  async update(
    id: number,
    updateNotificationInput: UpdateNotificationInput,
  ): Promise<Notification> {
    const { titulo, tipo, message } = updateNotificationInput;
    const notification = await super.baseFindOne({ id });
    if (!notification) {
      throw new NotFoundError();
    }
    if (notification.status === 'sent') {
      throw new BadRequestError('Cannot update a sent notification.');
    }
    return super.baseUpdate({ id, data: { titulo, tipo, message } });
  }

  async remove(ids: number[]): Promise<Notification[]> {
    for (const id of ids) {
      const notification = await super.baseFindOne({ id });
      if (notification.status === 'sent') {
        throw new BadRequestError('Cannot delete a sent notification.');
      }
    }
    return super.baseDeleteMany({ ids });
  }

  async markNotificationAsRead(
    currentUser: JWTPayload,
    id: number,
  ): Promise<NotificationLog> {
    const notificationLog =
      await this.notificationLogService.baseFindOneByFilters({
        filters: { user: { id: currentUser.sub }, notification: { id } },
        relationsToLoad: { user: true, notification: true },
      });
    if (!notificationLog) {
      throw new NotFoundError();
    }

    notificationLog.read = true;
    this.notificationLogService.baseUpdate({
      id: notificationLog.id as number,
      data: notificationLog,
    });
    return notificationLog;
  }

  async markNotificationAsDeleted(
    currentUser: JWTPayload,
    id: number,
  ): Promise<NotificationLog> {
    const notificationLog =
      await this.notificationLogService.baseFindOneByFilters({
        filters: { user: { id: currentUser.sub }, notification: { id } },
        relationsToLoad: { user: true, notification: true },
      });
    if (!notificationLog) {
      throw new NotFoundError();
    }

    notificationLog.erased = true;
    this.notificationLogService.baseUpdate({
      id: notificationLog.id as number,
      data: notificationLog,
    });
    return notificationLog;
  }

  async markNotificationsAsDeleted(
    currentUser: JWTPayload,
    ids: Array<number>,
  ): Promise<Array<NotificationLog>> {
    const notificationLogs: Array<NotificationLog> = [];
    for (const id of ids) {
      const notificationLog =
        await this.notificationLogService.baseFindOneByFilters({
          filters: { user: { id: currentUser.sub }, notification: { id } },
          relationsToLoad: { user: true, notification: true },
        });
      if (notificationLog) {
        notificationLogs.push(notificationLog);
        notificationLog.erased = true;
        this.notificationLogService.baseUpdate({
          id: notificationLog.id as number,
          data: notificationLog,
        });
      }
    }
    return notificationLogs;
  }

  public async publishNotification(
    notificationId: number,
    currentUser?: JWTPayload,
  ) {
    const { id, titulo, tipo, message, notificationLogs } =
      await this.findOne(notificationId);
    if (!titulo && !message) {
      throw new NotFoundError('Notification not found');
    }
    this.baseUpdate({
      id: id as number,
      data: {
        status: 'sent',
        sentBy: currentUser ? ({ id: currentUser?.sub } as User) : undefined,
        sentAt: new Date(),
      },
    });
    const messageToSend = JSON.stringify({ titulo, tipo, message });
    const notify = notificationLogs.map((n) => String(n.user.id));
    this.appEventService.publish({ message: messageToSend, notify });
  }

  private async findUsers(
    createNotificationInput: CreateNotificationInput | UpdateNotificationInput,
  ): Promise<User[]> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userIds, officeIds, departmentIds, teamIds, roles } =
      createNotificationInput;
    let notify: User[] = [];

    if (Array.isArray(userIds)) {
      for (const id of userIds) {
        const users = await this.userRepository.find({
          where: { id: Number(id) },
        });
        notify = notify.concat(users);
      }
    }

    // if (Array.isArray(officeIds)) {
    //   for (const id of officeIds) {
    //     const users = await this.userRepository.find({
    //       where: { office: { id: Number(id) } },
    //     });
    //     notify = notify.concat(users);
    //   }
    // }

    // if (Array.isArray(departmentIds)) {
    //   for (const id of departmentIds) {
    //     const users = await this.userRepository.find({
    //       where: { department: { id: Number(id) } },
    //     });
    //     notify = notify.concat(users);
    //   }
    // }

    // if (Array.isArray(teamIds)) {
    //   for (const id of teamIds) {
    //     const users = await this.userRepository.find({
    //       where: { team: { id: Number(id) } },
    //     });
    //     notify = notify.concat(users);
    //   }
    // }

    if (Array.isArray(roles)) {
      for (const role of roles) {
        const users = await this.userRepository.find({
          where: { role: ArrayContains([role]) },
        });
        notify = notify.concat(users);
      }
    }

    if (Array.isArray(roles)) {
      for (const role of roles) {
        const users = await this.userRepository.find({
          where: { role: ArrayContains([role]) },
        });
        notify = notify.concat(users);
      }
    }

    //remove duplicates or delete duplicates
    const result = notify.filter(
      (val, ind, arr) => arr.findIndex((val2) => val2.id === val.id) === ind,
    );
    return result;
  }

  async createAndPublish(createNotificationInput: CreateNotificationInput) {
    return this.create(false, createNotificationInput).then((n) => {
      return this.publishNotification(n.id as number);
    });
  }
}
