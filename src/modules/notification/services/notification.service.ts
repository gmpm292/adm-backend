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

/**
 * Notificaciones internas: se crean para una lista de destinatarios (una fila
 * de `NotificationLog` por usuario) y se publican por la suscripción
 * `appEvents`. Cada usuario las marca como leídas o borradas por su cuenta.
 */
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

  /**
   * Crea la notificación (sin publicarla) y una entrada por destinatario.
   * Con `currentUser` en `false` (avisos del sistema) figura como autor el
   * primer usuario SUPER.
   */
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

  /**
   * Listado de administración: quien no es SUPER solo ve las que creó. Añade
   * a cada una `users`, sus destinatarios.
   */
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
  }

  /**
   * Bandeja del usuario actual: sus entradas de notificaciones ya enviadas
   * que no ha borrado. Devuelve `NotificationLog`, no `Notification`.
   */
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

    return this.notificationLogService.baseFind({
      options,
      relationsToLoad: ['notification', 'user'],
    });
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

  /**
   * Cambia título, tipo y mensaje; los destinatarios no se tocan. Una
   * notificación enviada no se edita.
   */
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

  /** Elimina por lote; si alguna ya se envió, no elimina ninguna. */
  async remove(ids: number[]): Promise<Notification[]> {
    for (const id of ids) {
      const notification = await super.baseFindOne({ id });
      if (notification.status === 'sent') {
        throw new BadRequestError('Cannot delete a sent notification.');
      }
    }
    return super.baseDeleteMany({ ids });
  }

  /**
   * Marca como leída la entrada del usuario actual para esa notificación
   * (NotFound si no es suya).
   */
  async markNotificationAsRead(
    currentUser: JWTPayload,
    id: number,
  ): Promise<NotificationLog> {
    const notificationLog =
      await this.notificationLogService.baseFindOneByFilters({
        filters: { user: { id: currentUser.sub }, notification: { id } },
        relationsToLoad: { user: true, notification: true },
      });

    notificationLog.read = true;
    await this.notificationLogService.baseUpdate({
      id: notificationLog.id as number,
      data: notificationLog,
    });
    return notificationLog;
  }

  /**
   * Oculta la notificación de la bandeja del usuario actual (`erased`); no
   * la elimina para los demás. NotFound si no es suya.
   */
  async markNotificationAsDeleted(
    currentUser: JWTPayload,
    id: number,
  ): Promise<NotificationLog> {
    const notificationLog =
      await this.notificationLogService.baseFindOneByFilters({
        filters: { user: { id: currentUser.sub }, notification: { id } },
        relationsToLoad: { user: true, notification: true },
      });

    notificationLog.erased = true;
    await this.notificationLogService.baseUpdate({
      id: notificationLog.id as number,
      data: notificationLog,
    });
    return notificationLog;
  }

  /** Igual que la anterior por lote; ignora los ids que no son del usuario. */
  async markNotificationsAsDeleted(
    currentUser: JWTPayload,
    ids: Array<number>,
  ): Promise<Array<NotificationLog>> {
    const notificationLogs: Array<NotificationLog> = [];
    for (const id of ids) {
      const notificationLog = await this.notificationLogService
        .baseFindOneByFilters({
          filters: { user: { id: currentUser.sub }, notification: { id } },
          relationsToLoad: { user: true, notification: true },
        })
        .catch((error: unknown) => {
          if (error instanceof NotFoundError) return null;
          throw error;
        });
      if (notificationLog) {
        notificationLog.erased = true;
        await this.notificationLogService.baseUpdate({
          id: notificationLog.id as number,
          data: notificationLog,
        });
        notificationLogs.push(notificationLog);
      }
    }
    return notificationLogs;
  }

  /**
   * Marca la notificación como enviada y la emite por `appEvents` a sus
   * destinatarios (ids de usuario en `notify`).
   */
  public async publishNotification(
    notificationId: number,
    currentUser?: JWTPayload,
  ) {
    const { id, titulo, tipo, message, notificationLogs } =
      await this.findOne(notificationId);
    if (!titulo && !message) {
      throw new NotFoundError('Notification not found');
    }
    await this.baseUpdate({
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

  /**
   * Destinatarios sin repetir: los `userIds` más los usuarios de cada rol de
   * `roles`. `officeIds`, `departmentIds` y `teamIds` se ignoran por ahora.
   */
  private async findUsers(
    createNotificationInput: CreateNotificationInput | UpdateNotificationInput,
  ): Promise<User[]> {
    const { userIds, roles } = createNotificationInput;
    let notify: User[] = [];

    if (Array.isArray(userIds)) {
      for (const id of userIds) {
        const users = await this.userRepository.find({
          where: { id: Number(id) },
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

    // Quita los usuarios repetidos.
    const result = notify.filter(
      (val, ind, arr) => arr.findIndex((val2) => val2.id === val.id) === ind,
    );
    return result;
  }

  /** Crea y publica en un paso, como aviso del sistema (sin usuario). */
  async createAndPublish(createNotificationInput: CreateNotificationInput) {
    return this.create(false, createNotificationInput).then((n) => {
      return this.publishNotification(n.id as number);
    });
  }
}
