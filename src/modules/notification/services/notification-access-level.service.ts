/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { User } from '../../users/entities/user.entity';
import {
  ListFilter,
  ListOptions,
} from '../../../core/graphql/remote-operations';
import { Role } from '../../../core/enums/role.enum';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';
import { Notification } from '../entities/notification.entity';

/**
 * Alcance de las notificaciones según el rol y el lugar del usuario en la
 * empresa. Lo aplica el resolver antes de llamar a `NotificationService`.
 */
@Injectable()
export class NotificationAccessLevelService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  /**
   * Añade al listado el filtro por autor: ADMIN ve las creadas en su oficina,
   * MANAGER en su departamento y SUPERVISOR en su equipo. El resto, sin filtro.
   */
  public async forFind(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListOptions> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    if (!options || !options.filters) {
      options = { ...options, filters: [] } as ListOptions;
    }

    /**
     * add filters
     */
    if (user.role?.some((r) => r === Role.ADMIN)) {
      options.filters?.push({
        property: 'createdBy.officeId',
        operator: ConditionalOperator.EQUAL,
        value: user.office?.id?.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    } else if (user.role?.some((r) => r === Role.MANAGER)) {
      options.filters?.push({
        property: 'createdBy.departmentId',
        operator: ConditionalOperator.EQUAL,
        value: user.department?.id?.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    } else if (user.role?.some((r) => r === Role.SUPERVISOR)) {
      options.filters?.push({
        property: 'createdBy.teamId',
        operator: ConditionalOperator.EQUAL,
        value: user.team?.id?.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    }
    return options;
  }

  /**
   * Filtro para leer una notificación. Hoy solo filtra por id: el alcance por
   * rol está comentado. Sí valida el lugar del usuario en la empresa.
   */
  public async forFindOne(
    currentUser: JWTPayload,
    id: number,
  ): Promise<FindOptionsWhere<Notification>> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    // eslint-disable-next-line prefer-const
    let filters: FindOptionsWhere<Notification> = { id };
    // filters;

    // /**
    //  * add filters
    //  */
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = {
    //     ...filters,
    //     createdBy: { office: { id: user.office.id } },
    //   };
    // } else if (user.role.some((r) => r === Role.MANAGER)) {
    //   filters = {
    //     ...filters,
    //     createdBy: { department: { id: user.department.id } },
    //   };
    // } else if (user.role.some((r) => r === Role.SUPERVISOR)) {
    //   filters = {
    //     ...filters,
    //     createdBy: { team: { id: user.team.id } },
    //   };
    // }

    return filters;
  }

  /**
   * Comprueba que el usuario tenga justo el lugar que pide su rol (SUPER y
   * PRINCIPAL sin oficina, ADMIN con oficina...). Si no, lanza Forbidden.
   */
  private async chekCompanyInfo(user: User): Promise<void> {
    if (
      user.role?.some((r) => r === Role.SUPER) &&
      (user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user cannot have an office, department or team.',
      );
    }
    if (
      user.role?.some((r) => r === Role.PRINCIPAL) &&
      (user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user cannot have an office, department or team.',
      );
    }
    if (
      user.role?.some((r) => r === Role.ADMIN) &&
      (!user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an office or has a department or team.',
      );
    }
    if (
      user.role?.some((r) => r === Role.MANAGER) &&
      (!user.office || !user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an office or department or has a team.',
      );
    }
    if (
      user.role?.some((r) => r === Role.SUPERVISOR) &&
      (!user.office || !user.department || !user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an office or department or team.',
      );
    }
    if (
      user.role?.some((r) => r === Role.AGENT) &&
      (!user.office || !user.department || !user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an office or department or team.',
      );
    }
    if (user.role?.some((r) => r === Role.USER) && !user.office) {
      throw new ForbiddenResourceError('This user does not have an office.');
    }
    return;
  }

  private async findUser(currentUser: JWTPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: currentUser.sub },
      relations: { office: true, department: true, team: true },
    });
    return user as User;
  }
}
