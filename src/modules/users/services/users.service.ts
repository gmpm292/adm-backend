/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';

import { ConfirmationTokenService } from '../confirmationToken/services/confirmation-token.service';
import { CreateFirstUserInput } from '../dto/create-first-user.input';

import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { UpdateUserProfileInput } from '../dto/update-user-profile.input';
import { UpdateUserRoleInput } from '../dto/update-user-role.input';
import { User } from '../entities/user.entity';
import { BaseService } from '../../../core/services/base.service';
import { NotFoundError } from '../../../core/errors/appErrors/NotFoundError.error';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { Role } from '../../../core/enums/role.enum';
import { ConflictError } from '../../../core/errors/appErrors/ConflictError.error';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { DisabledUserError } from '../../../core/errors/appErrors/DisabledUserError.error';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../scoped-access/services/scoped-access.service';
import { Business } from '../../company/business/entities/co_business.entity';
import { Office } from '../../company/office/entities/co_office.entity';
import { Team } from '../../company/team/entities/co_team.entity';
import { Department } from '../../company/department/entities/co_department.entity';

@Injectable()
export class UsersService extends BaseService<User> {
  public constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    private confirmationTokenService: ConfirmationTokenService,
    @InjectEntityManager()
    private readonly mannager: EntityManager,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(usersRepository);
  }

  public async changePassword({
    confirmationToken,
    newPassword,
  }): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { confirmationTokens: { tokenValue: confirmationToken } },
      relations: {
        confirmationTokens: true,
        business: true,
        office: true,
        department: true,
        team: true,
      },
    });
    // Bloquear cambio de contraseña para usuario sistema
    if (user?.email === 'system@admin.com') {
      throw new BadRequestError('Cannot change password for system user');
    }
    if (!user) {
      throw new NotFoundError('Confirmation token not found');
    }
    const confirmationTokens = user.confirmationTokens;
    const activeToken = confirmationTokens?.find(
      (ct) =>
        ct.expirationDate > new Date() &&
        !ct.used &&
        ct.tokenValue == confirmationToken,
    );
    if (!activeToken) {
      throw new UnauthorizedError(
        'This user not has active confirmation token',
      );
    }

    await this.confirmationTokenService.markTokenAsUsed(
      activeToken.id as number,
    );
    const propertiesToUpdateAndRetrieve = {
      enabled: true,
    };

    // await this.usersRepository.update(
    //   { id: user.id },
    //   {
    //     email: user.email,
    //     password: await hash(newPassword, 10),
    //     ...propertiesToUpdateAndRetrieve,
    //   },
    // );
    await super.baseUpdate({
      id: user.id as number,
      data: {
        email: user.email,
        password: await hash(newPassword, 10),
        ...propertiesToUpdateAndRetrieve,
      },
      cu: {
        sub: user.id as number,
        role: user.role as Array<Role>,
        businessId: user.business?.id,
        officeId: user.office?.id,
        departmentId: user.department?.id,
        teamId: user.team?.id,
      },
      //cu: { sub: 1 as number, role: [Role.SUPER] as Array<Role> }, //TODO Urgente
    });

    // Add Logs in future

    return {
      ...user,
      ...propertiesToUpdateAndRetrieve,
    };
  }

  public async checkConfirmationToken({ confirmationToken }): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { confirmationTokens: { tokenValue: confirmationToken } },
      relations: { confirmationTokens: true },
    });
    if (!user) {
      throw new NotFoundError('Confirmation token not found');
    }
    const confirmationTokens = user.confirmationTokens;
    const activeToken = confirmationTokens?.find(
      (ct) =>
        ct.expirationDate > new Date() &&
        !ct.used &&
        ct.tokenValue == confirmationToken,
    );
    if (activeToken) {
      return true;
    }
    return false;
  }

  public async changePasswordByEmail(
    { email, newPassword },
    currentUser: JWTPayload,
  ): Promise<User> {
    if (email === 'system@admin.com') {
      throw new BadRequestError('Cannot change password for system user');
    }
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    //If user has active confirmation token markTokenAsUsed
    const confirmationTokens = user.confirmationTokens;
    const activeToken = confirmationTokens?.find(
      (ct) => ct.expirationDate > new Date() && !ct.used,
    );
    if (activeToken) {
      await this.confirmationTokenService.markTokenAsUsed(
        activeToken.id as number,
      );
    }

    const propertiesToUpdateAndRetrieve = {
      enabled: true,
    };

    await this.usersRepository.update(
      { id: user.id },
      {
        email: user.email,
        password: await hash(newPassword, 10),
        ...propertiesToUpdateAndRetrieve,
      },
    );

    // Add Logs in future

    return {
      ...user,
      ...propertiesToUpdateAndRetrieve,
    };
  }

  public async createFirstUser(
    createFirstUserInput: CreateFirstUserInput,
  ): Promise<User> {
    const numUsers = (
      await this.find({
        take: 0,
        filters: [
          {
            property: 'email',
            operator: ConditionalOperator.DISTINCT,
            value: 'system@admin.com',
          },
        ],
      })
    ).totalCount;
    if (numUsers < 1) {
      const { newPassword, ...rest } = createFirstUserInput;
      const createdUser = await this.usersRepository.save({
        ...rest,
        ...{ enabled: true, role: [Role.SUPER] },
      });

      // Add Log in future

      await this.changePasswordByEmail(
        {
          email: createdUser.email,
          newPassword,
        },
        {
          sub: createdUser.id as number,
          role: [Role.SUPER],
        },
      );
      return createdUser;
    } else {
      throw new ConflictError('Users already exist');
    }
  }

  public async create(
    createUserInput: CreateUserInput,
    cu?: JWTPayload,
  ): Promise<User> {
    await this.checkUserInformation(createUserInput, cu as JWTPayload);
    const { name, lastName, ...rest } = createUserInput;
    const fullName = `${name?.trim() ?? ''} ${lastName?.trim() ?? ''}`;
    const user: User = {
      name,
      lastName,
      fullName,
      ...rest,
    };

    await this.validateUniqueFields(user);

    let createdUser: User;
    try {
      //createdUser = await this.usersRepository.save(user);
      createdUser = await super.baseCreate({
        data: user,
        cu,
        isSecurityBaseEntity: true,
      });
    } catch (e) {
      throw new ConflictError(e.message);
    }
    const confirmationToken =
      await this.confirmationTokenService.createConfirmationToken(
        createdUser.id as number,
      );
    createdUser.confirmationToken = confirmationToken.tokenValue;

    // Add Log in future

    return createdUser;
  }

  public async find(options?: ListOptions): Promise<ListSummary> {
    return super.baseFind({
      options,
      relationsToLoad: ['office', 'department', 'team'],
    });
  }

  public findCustomers(options?: ListOptions): Promise<ListSummary> {
    return super.baseFind({
      options,
      relationsToLoad: ['office', 'department', 'team'],
    });
  }

  public async findByEmail(email: string, withDeleted = false): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: {
        business: true,
        office: true,
        department: true,
        team: true,
        confirmationTokens: true,
      },
      withDeleted,
    });

    if (!user) {
      throw new NotFoundError();
    }

    return user;
  }

  public async findByRole(role: Role): Promise<User[]> {
    return await this.usersRepository
      .createQueryBuilder()
      .where(`:role = ANY (u.role)`, { role })
      .getMany();
  }

  public async findOne(
    id: number,
    filters: FindOptionsWhere<User> = {},
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id, ...filters },
      relations: {
        business: true,
        office: true,
        department: true,
        team: true,
        confirmationTokens: true,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    return user;
  }

  public async remove(
    ids: number[],
    filters: FindOptionsWhere<User> = {},
    currentUser: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<User[]> {
    const users = await this.usersRepository.findBy({
      id: In(ids),
      ...filters,
    });

    if (users.length === 0) {
      throw new NotFoundError();
    }

    await this.usersRepository.softDelete(ids);

    // Add Log in future

    return users;
  }

  public async restore(
    ids: number[],
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    return super.baseRestoreDeletedMany({ ids, manager, cu, scopes });
  }

  public async removeAll(): Promise<boolean> {
    const deleteResult = await this.usersRepository.delete({});

    return Boolean(deleteResult.affected);
  }

  public async saveRefreshToken(
    id: number,
    refreshToken: string | null,
  ): Promise<boolean> {
    // if refreshToken is not empty then hash it and save it
    const updateResult = await this.usersRepository.update(id, {
      //refreshToken: refreshToken ? await hash(refreshToken, 10) : null,
      refreshToken: refreshToken ? refreshToken : (null as any),
    });

    return Boolean(updateResult.affected);
  }

  public async save2FASecret(id: number, twoFASecret: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        enabled: true,
        fullName: true,
        isTwoFactorEnabled: true,
        twoFASecret: true,
        isTwoFactorConfigured: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (user.isTwoFactorConfigured) {
      throw new ForbiddenResourceError(
        'Two-factor authentication is already configured',
      );
    }
    await this.usersRepository.update(id, {
      email: user.email,
      twoFASecret,
      isTwoFactorEnabled: true,
      isTwoFactorConfigured: false,
    });

    return user;
  }

  public async finishConfigure2FA(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        enabled: true,
        fullName: true,
        isTwoFactorEnabled: true,
        twoFASecret: true,
        isTwoFactorConfigured: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!user.twoFASecret) {
      throw new UnauthorizedError(`You don't have a secret code`);
    }
    if (!user.isTwoFactorEnabled) {
      throw new UnauthorizedError('Two-factor authentication not enable');
    }
    if (user.isTwoFactorConfigured) {
      throw new ForbiddenResourceError(
        'Two-factor authentication is already configured',
      );
    }
    await this.usersRepository.update(id, {
      email: user.email,
      isTwoFactorEnabled: true,
      isTwoFactorConfigured: true,
    });

    return user;
  }

  async reset2FASettings(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        enabled: true,
        fullName: true,
        isTwoFactorEnabled: true,
        twoFASecret: true,
        isTwoFactorConfigured: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!user.isTwoFactorEnabled) {
      throw new ForbiddenResourceError('Two-factor authentication not enable');
    }
    await this.usersRepository.update(id, {
      email: user.email,
      isTwoFactorEnabled: true,
      isTwoFactorConfigured: false,
    });

    return user;
  }

  async enable2FA(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        enabled: true,
        fullName: true,
        isTwoFactorEnabled: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (user.isTwoFactorEnabled) {
      throw new ForbiddenResourceError('Two-factor authentication enable');
    }
    await this.usersRepository.update(id, {
      email: user.email,
      isTwoFactorEnabled: true,
    });

    return user;
  }

  async disable2FA(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        enabled: true,
        fullName: true,
        isTwoFactorEnabled: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!user.isTwoFactorEnabled) {
      throw new ForbiddenResourceError('Two-factor authentication not enable');
    }
    await this.usersRepository.update(id, {
      email: user.email,
      isTwoFactorEnabled: false,
    });

    return user;
  }

  public async update(
    id: number,
    updateUserInput: Omit<UpdateUserInput, 'id'>,
    currentUser: JWTPayload,
    filters: FindOptionsWhere<User> = {},
  ): Promise<User | null> {
    await this.checkUserInformation(updateUserInput, currentUser);
    const { name, lastName, officeId, departmentId, teamId, ...rest } =
      updateUserInput;
    const savedUser = await this.findOne(id, filters);
    if (!savedUser) {
      throw new NotFoundError();
    }

    const user: User = {
      email: updateUserInput.email ?? savedUser.email,
      name: updateUserInput.name ?? savedUser.name,
      lastName: updateUserInput.lastName ?? savedUser.lastName,
      mobile: updateUserInput.mobile ?? savedUser.mobile,
      enabled: updateUserInput.enabled ?? savedUser.enabled,
      // role: updateUserInput.role ?? savedUser.role,
      // office: officeId
      //   ? await this.officeRepository.findOne({ where: { id: officeId } })
      //   : updateUserInput.role
      //     ? null
      //     : savedUser.office,
      // department: departmentId
      //   ? await this.departmentRepository.findOne({
      //       where: { id: departmentId },
      //     })
      //   : updateUserInput.role
      //     ? null
      //     : savedUser.department,
      // team: teamId
      //   ? await this.teamRepository.findOne({ where: { id: teamId } })
      //   : updateUserInput.role
      //     ? null
      //     : savedUser.team,
    } as unknown as User;

    if (name || lastName) {
      user.name = name || user.name;
      user.lastName = lastName || user.lastName;
      user.fullName = `
      ${user.name?.trim() ?? ''} ${user.lastName?.trim() ?? ''}`;
    }

    // if password has value, it must be hashed
    if (updateUserInput.password) {
      Object.assign(updateUserInput, {
        password: await hash(updateUserInput.password, 10),
      });
    }

    if (updateUserInput.email && savedUser.email != updateUserInput.email) {
      await this.validateUniqueEmail({ ...savedUser, ...rest });
    }
    // ClickUpUrl: https://app.clickup.com/t/86az5nkq5
    // if (updateUserInput.mobile && savedUser.mobile != updateUserInput.mobile) {
    //   await this.validateUniquePhone({ ...savedUser, ...rest });
    // }

    await this.usersRepository.update({ id }, user as any);

    // // save historical if role is USER(Customer)
    // if (user.role.some((r) => r == Role.USER)) {
    //   const history: CreateCustomerHistory = {
    //     changes: { ...updateUserInput, id },
    //     contents: user,
    //     previousContents: savedUser,
    //     updateBy: { id: currentUser.sub } as User,
    //     customer: { id } as User,
    //   };
    //   this.customerHistory
    //     .create(history)
    //     .catch((e) =>
    //       console.log('Error UPDATING customer history ', e.message),
    //     );
    // }

    // // Add Log in WorkerLogs
    // this.workerLogsService.create({
    //   info: 'Update User',
    //   workerId: currentUser.sub,
    //   userId: savedUser.id,
    // });

    return { ...savedUser, ...user };
  }

  public async updateUserProfile(
    currentUser: JWTPayload,
    updateUserProfileInput: UpdateUserProfileInput,
  ): Promise<User | null> {
    const savedUser = await this.findOne(currentUser.sub);
    if (!savedUser) {
      throw new NotFoundError();
    }

    const user: User = {
      email: updateUserProfileInput.email ?? savedUser.email,
      name: updateUserProfileInput.name ?? savedUser.name,
      lastName: updateUserProfileInput.lastName ?? savedUser.lastName,
      mobile: updateUserProfileInput.mobile ?? savedUser.mobile,
    } as unknown as User;
    user.fullName = `${user.name?.trim() ?? ''} ${user.lastName?.trim() ?? ''}`;

    if (
      updateUserProfileInput.email &&
      savedUser.email != updateUserProfileInput.email
    ) {
      await this.validateUniqueEmail({
        ...savedUser,
        ...updateUserProfileInput,
      });
    }
    if (
      updateUserProfileInput.mobile &&
      savedUser.mobile != updateUserProfileInput.mobile
    ) {
      await this.validateUniquePhone({
        ...savedUser,
        ...updateUserProfileInput,
      });
    }
    await this.usersRepository.update({ id: currentUser.sub }, user as any);

    // // save historical if role is USER(Customer)
    // if (savedUser.role.some((r) => r == Role.USER)) {
    //   const history: CreateCustomerHistory = {
    //     changes: { ...updateUserProfileInput, id: currentUser.sub },
    //     contents: user,
    //     previousContents: savedUser,
    //     updateBy: { id: currentUser.sub } as User,
    //     customer: { id: currentUser.sub } as User,
    //   };
    //   this.customerHistory
    //     .create(history)
    //     .catch((e) =>
    //       console.log('Error UPDATING customer history ', e.message),
    //     );
    // }

    // // Add Log in WorkerLogs
    // this.workerLogsService.create({
    //   info: 'Update User Profile',
    //   workerId: currentUser.sub,
    //   userId: savedUser.id,
    // });

    return { ...savedUser, ...user };
  }

  public async updateUserRole(
    id: number,
    updateUserRoleInput: UpdateUserRoleInput,
    currentUser: JWTPayload,
    filters: FindOptionsWhere<User> = {},
  ): Promise<User | null> {
    await this.checkUserInformation(updateUserRoleInput, currentUser);
    const { officeId, departmentId, teamId } = updateUserRoleInput;
    const savedUser = await this.findOne(id, filters);
    if (!savedUser) {
      throw new NotFoundError();
    }

    if (
      updateUserRoleInput.role.some((r) => r === Role.USER) ||
      savedUser.role?.some((r) => r === Role.USER)
    ) {
      throw new BadRequestError('The user cannot be customer.');
    }

    const user: User = {
      role: updateUserRoleInput.role ?? savedUser.role,
      email: savedUser.email,
      office: officeId
        ? { id: officeId }
        : updateUserRoleInput.role
          ? null
          : savedUser.office,
      department: departmentId
        ? { id: departmentId }
        : updateUserRoleInput.role
          ? null
          : savedUser.department,
      team: teamId
        ? { id: teamId }
        : updateUserRoleInput.role
          ? null
          : savedUser.team,
    } as User;

    await this.chekCompanyInfo(user);

    await this.usersRepository.update({ id }, user as any);

    // // Add Log in WorkerLogs
    // this.workerLogsService.create({
    //   info: 'Update User Role',
    //   workerId: currentUser.sub,
    //   userId: savedUser.id,
    // });

    return { ...savedUser, ...user };
  }

  private async checkUserInformation(
    userInput:
      | CreateUserInput
      | Omit<UpdateUserInput, 'id'>
      | UpdateUserRoleInput,
    currentUser: JWTPayload,
  ): Promise<void> {
    if (userInput.role) {
      if (userInput.role.some((r) => r === Role.SUPER)) {
        if (
          userInput.businessId ||
          userInput.officeId ||
          userInput.departmentId ||
          userInput.teamId
        ) {
          throw new BadRequestError(
            'The super cannot have a business, office, department or team',
          );
        }
      }
      if (userInput.role.some((r) => r === Role.PRINCIPAL)) {
        if (!userInput.businessId) {
          throw new BadRequestError('The principal has no business.');
        }
        if (userInput.officeId || userInput.departmentId || userInput.teamId) {
          throw new BadRequestError(
            'The principal cannot have a office, department or team',
          );
        }
      }
      if (userInput.role.some((r) => r === Role.ADMIN)) {
        if (!userInput.businessId || !userInput.officeId) {
          throw new BadRequestError(
            'The administrator has no business or office',
          );
        }
        if (userInput.departmentId || userInput.teamId) {
          throw new BadRequestError(
            'The administrator cannot have a department or team',
          );
        }
      }
      if (userInput.role.some((r) => r === Role.MANAGER)) {
        if (
          !userInput.businessId ||
          !userInput.officeId ||
          !userInput.departmentId
        ) {
          throw new BadRequestError(
            'The manager has no business or office or department',
          );
        }
        if (userInput.teamId) {
          throw new BadRequestError('The manager cannot have a team');
        }
      }
      if (
        userInput.role.some((r) => r === Role.SUPERVISOR) &&
        (!userInput.businessId ||
          !userInput.officeId ||
          !userInput.departmentId ||
          !userInput.teamId)
      ) {
        throw new BadRequestError(
          'The supervisor has no business, office, department or team',
        );
      }
      if (
        userInput.role.some((r) => r === Role.AGENT) &&
        (!userInput.businessId ||
          !userInput.officeId ||
          !userInput.departmentId ||
          !userInput.teamId)
      ) {
        throw new BadRequestError(
          'The agent has no business, office, department or team',
        );
      }
      if (
        userInput.role.some((r) => r === Role.USER) &&
        !userInput.businessId
      ) {
        throw new BadRequestError('The user has no business');
      }

      //Check that a role cannot create a higher one
      if (currentUser.role.some((r) => r === Role.PRINCIPAL)) {
        if (userInput.role.some((r) => r === Role.SUPER)) {
          throw new BadRequestError(
            'You cannot create a user with a role higher than yours',
          );
        }
      }
      if (currentUser.role.some((r) => r === Role.ADMIN)) {
        if (
          userInput.role.some((r) => r === Role.SUPER) ||
          userInput.role.some((r) => r === Role.PRINCIPAL) ||
          userInput.role.some((r) => r === Role.ADMIN)
        ) {
          throw new BadRequestError(
            'You cannot create a user with a role greater than or equal to yours',
          );
        }
      }
      if (currentUser.role.some((r) => r === Role.MANAGER)) {
        if (
          userInput.role.some((r) => r === Role.SUPER) ||
          userInput.role.some((r) => r === Role.PRINCIPAL) ||
          userInput.role.some((r) => r === Role.ADMIN) ||
          userInput.role.some((r) => r === Role.MANAGER)
        ) {
          throw new BadRequestError(
            'You cannot create a user with a role greater than or equal to yours',
          );
        }
      }
      if (currentUser.role.some((r) => r === Role.SUPERVISOR)) {
        if (
          userInput.role.some((r) => r === Role.SUPER) ||
          userInput.role.some((r) => r === Role.PRINCIPAL) ||
          userInput.role.some((r) => r === Role.ADMIN) ||
          userInput.role.some((r) => r === Role.MANAGER) ||
          userInput.role.some((r) => r === Role.SUPERVISOR)
        ) {
          throw new BadRequestError(
            'You cannot create a user with a role greater than or equal to yours',
          );
        }
      }
      if (currentUser.role.some((r) => r === Role.AGENT)) {
        if (
          userInput.role.some((r) => r === Role.SUPER) ||
          userInput.role.some((r) => r === Role.PRINCIPAL) ||
          userInput.role.some((r) => r === Role.ADMIN) ||
          userInput.role.some((r) => r === Role.MANAGER) ||
          userInput.role.some((r) => r === Role.SUPERVISOR) ||
          userInput.role.some((r) => r === Role.AGENT)
        ) {
          throw new BadRequestError(
            'You cannot create a user with a role greater than or equal to yours',
          );
        }
      }
    }
    return;
  }

  public async chekCompanyInfo(user: User): Promise<void> {
    if (!user.role) {
      throw new ConflictError();
    }
    if (
      user.role.some((r) => r === Role.SUPER) &&
      (user.business || user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user cannot have an business, office, department or team.',
      );
    }
    if (
      user.role.some((r) => r === Role.PRINCIPAL) &&
      (!user.business || user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an business or has a office, department or team.',
      );
    }
    if (
      user.role.some((r) => r === Role.ADMIN) &&
      (!user.business || !user.office || user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an business or office or has a department or team.',
      );
    }
    if (
      user.role.some((r) => r === Role.MANAGER) &&
      (!user.business || !user.office || !user.department || user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an business or office or department or has a team.',
      );
    }
    if (
      user.role.some((r) => r === Role.SUPERVISOR) &&
      (!user.business || !user.office || !user.department || !user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an business or office or department or team.',
      );
    }
    if (
      user.role.some((r) => r === Role.AGENT) &&
      (!user.business || !user.office || !user.department || !user.team)
    ) {
      throw new ForbiddenResourceError(
        'This user does not have an business or office or department or team.',
      );
    }
    if (user.role.some((r) => r === Role.USER) && !user.business) {
      throw new ForbiddenResourceError('This user does not have an business.');
    }
    return;
  }

  async validateUniqueFields(user: User) {
    let findEmail = {
      take: 0,
      filters: [
        {
          property: 'email',
          operator: ConditionalOperator.EQUAL,
          value: user.email,
          logicalOperator: LogicalOperator.OR,
        },
      ],
    } as ListOptions;
    let findMobile = {
      take: 0,
      filters: [
        {
          property: 'mobile',
          operator: ConditionalOperator.EQUAL,
          value: user.mobile,
          logicalOperator: LogicalOperator.OR,
        },
      ],
    } as ListOptions;
    let usersInDB = await this.find(findEmail);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError('The email of this user already exists');
    }
    usersInDB = await this.find(findMobile);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError('The mobile of this user already exists');
    }

    findEmail = { ...findEmail, withDeleted: true };
    findMobile = { ...findMobile, withDeleted: true };
    usersInDB = await this.find(findEmail);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError(
        'The email of this user already exists, but this user is disable',
      );
    }
    usersInDB = await this.find(findMobile);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError(
        'The mobile of this user already exists, but this user is disable',
      );
    }
  }

  async validateUniqueEmail(user: User) {
    let options = {
      take: 0,
      filters: [
        {
          property: 'email',
          operator: ConditionalOperator.EQUAL,
          value: user.email,
        },
      ],
    } as ListOptions;
    let usersInDB = await this.find(options);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError('The email of this user already exists');
    }
    options = { ...options, withDeleted: true };
    usersInDB = await this.find(options);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError(
        'The email of this user already exists, but this user is deleted',
      );
    }
  }

  async validateUniquePhone(user: User) {
    let options = {
      take: 0,
      filters: [
        {
          property: 'mobile',
          operator: ConditionalOperator.EQUAL,
          value: user.mobile,
        },
      ],
    } as ListOptions;
    let usersInDB = await this.find(options);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError('The mobile of this user already exists');
    }
    options = { ...options, withDeleted: true };
    usersInDB = await this.find(options);
    if (usersInDB.totalCount > 0) {
      throw new ConflictError(
        'The mobile of this user already exists, but this user is deleted',
      );
    }
  }

  public async findOneCustomer(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id, role: `{USER}` as Role },
      relations: {
        office: true,
        department: true,
        team: true,
        notificationLogs: true,
      },
    });

    if (!user) {
      throw new NotFoundError();
    }

    return user;
  }
}
