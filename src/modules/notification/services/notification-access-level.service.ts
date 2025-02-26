/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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

@Injectable()
export class NotificationAccessLevelService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

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
        value: user.office?.id.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    } else if (user.role?.some((r) => r === Role.MANAGER)) {
      options.filters?.push({
        property: 'createdBy.departmentId',
        operator: ConditionalOperator.EQUAL,
        value: user.department?.id.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    } else if (user.role?.some((r) => r === Role.SUPERVISOR)) {
      options.filters?.push({
        property: 'createdBy.teamId',
        operator: ConditionalOperator.EQUAL,
        value: user.team?.id.toString(),
        logicalOperator: LogicalOperator.AND,
      } as ListFilter);
    }
    return options;
  }

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
