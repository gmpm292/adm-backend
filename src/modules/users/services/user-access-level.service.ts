/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

import { ChangePasswordByEmailInput } from '../dto/change-password-by-email.input';
import { UpdateUserRoleInput } from '../dto/update-user-role.input';
import { Role } from '../../../core/enums/role.enum';
import { User } from '../entities/user.entity';
import {
  ListFilter,
  ListOptions,
} from '../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { CreateUserInput } from '../dto/create-user.input';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';

@Injectable()
export class UserAccessLevelService {
  private createUserTree: Map<Role, Role[]> = new Map();

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {
    this.constructCreateUserTree();
  }

  public async forChangePasswordByEmail(
    currentUser: JWTPayload,
    changePasswordByEmailInput: ChangePasswordByEmailInput,
  ): Promise<ChangePasswordByEmailInput> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    if (
      !user.role?.some(
        (r) => r === Role.SUPER, // || r === Role.PRINCIPAL || r === Role.ADMIN,
      )
    ) {
      changePasswordByEmailInput.email = user.email;
    }
    return changePasswordByEmailInput;
  }

  public async forFind(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListOptions> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    if (!options || !options.filters) {
      options = { ...options, filters: [] } as ListOptions;
    }

    // if (haveAccess(user.role, [Role.ADMIN]))
    //   options.filters.push({
    //     property: 'office.id',
    //     operator: ConditionalOperator.EQUAL,
    //     value: user.office?.id?.toString(),
    //     logicalOperator: LogicalOperator.AND,
    //     principal: true,
    //   } as ListFilter);

    // if (haveAccess(user.role, [Role.MANAGER])) {
    //   options.filters.push({
    //     property: 'department.id',
    //     operator: ConditionalOperator.EQUAL,
    //     value: user.department.id.toString(),
    //     logicalOperator: LogicalOperator.AND,
    //     principal: true,
    //   } as ListFilter);
    // }

    // if (haveAccess(user.role, [Role.SUPERVISOR])) {
    //   options.filters.push({
    //     property: 'team.id',
    //     operator: ConditionalOperator.EQUAL,
    //     value: user.team.id.toString(),
    //     logicalOperator: LogicalOperator.AND,
    //     principal: true,
    //   } as ListFilter);
    // }

    return options;
  }

  public async forFindCustomers(
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
    // options.filters.push({
    //   property: 'role',
    //   operator: ConditionalOperator.EQUAL,
    //   value: `{${Role.USER}}`,
    //   logicalOperator: LogicalOperator.AND,
    //   principal: true,
    // } as ListFilter);
    // if (haveAccess(user.role, [Role.AGENT])) {
    //   options.filters.push({
    //     property: 'customerRelations.userId',
    //     operator: ConditionalOperator.EQUAL,
    //     value: user.id.toString(),
    //     logicalOperator: LogicalOperator.AND,
    //     principal: true,
    //   } as ListFilter);
    // } else if (
    //   !user.role.some((r) => r === Role.SUPER || r === Role.PRINCIPAL)
    // ) {
    //   options.filters.push({
    //     property: 'office.id',
    //     operator: ConditionalOperator.EQUAL,
    //     value: user.office.id.toString(),
    //     logicalOperator: LogicalOperator.AND,
    //     principal: true,
    //   } as ListFilter);
    // }
    return options;
  }

  public async forFindGlobalCustomers(
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
    options.filters?.push({
      property: 'role',
      operator: ConditionalOperator.EQUAL,
      value: `{${Role.USER}}`,
      logicalOperator: LogicalOperator.AND,
      principal: true,
    } as ListFilter);
    return options;
  }

  public async forCreate(
    currentUser: JWTPayload,
    createUserInput: CreateUserInput,
  ): Promise<CreateUserInput> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);
    await this.chekCompanyInfoOfUserToBeCreated(createUserInput);

    if (
      !this.validateRoleToCreateUser(
        currentUser.role[0],
        createUserInput.role[0],
      )
    ) {
      throw new ForbiddenResourceError(
        'This user not have permition for create this role',
      );
    }

    if (
      user.role?.some((r) => r === Role.SUPER || r === Role.PRINCIPAL) &&
      !createUserInput.role.some(
        (rr) => rr === Role.SUPER || rr === Role.PRINCIPAL,
      ) &&
      !createUserInput.officeId
    ) {
      throw new BadRequestError('The office is required.');
    }
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   createUserInput.officeId = user.office.id;
    // }
    return createUserInput;
  }

  public async forRequestPasswordChangeForAnotherUser(
    currentUser: JWTPayload,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userToChangePass: User,
  ): Promise<boolean> {
    const currUser = await this.findUser(currentUser);
    await this.chekCompanyInfo(currUser);

    // if (
    //   currUser.role.some((r) => r === Role.ADMIN) &&
    //   currUser.office.id != userToChangePass.office.id
    // ) {
    //   throw new BadRequestError(
    //     'The user to change password does not belong to your office.',
    //   );
    // }
    return true;
  }

  public async forCreateCustomer(
    currentUser: JWTPayload,
    createUserInput: CreateUserInput,
  ): Promise<CreateUserInput> {
    const user = await this.findUser(currentUser);

    if (
      user.role?.some((r) => r === Role.SUPER || r === Role.PRINCIPAL) &&
      !createUserInput.officeId
    ) {
      throw new BadRequestError('The office is required.');
    }
    // if (!user.role.some((r) => r === Role.SUPER || r === Role.PRINCIPAL)) {
    //   createUserInput.officeId = user.office.id;
    // }
    await this.chekCompanyInfo(user);
    await this.chekCompanyInfoOfUserToBeCreated(createUserInput);

    createUserInput.role = [Role.USER];
    return createUserInput;
  }

  public async forFindOne(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    let filters: FindOptionsWhere<User> = {};
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = { office: { id: user.office.id } };
    // }
    // if (user.role.some((r) => r === Role.MANAGER)) {
    //   filters = { department: { id: user.department.id } };
    // }
    // if (user.role.some((r) => r === Role.SUPERVISOR)) {
    //   filters = { team: { id: user.team.id } };
    // }
    // if (user.role.some((r) => r === Role.AGENT)) {
    //   filters = { customerRelations: { user: { id: user.id } } };
    // }

    return { id, filters };
  }

  public async forUpdateUserRole(
    currentUser: JWTPayload,
    id: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateUserRoleInput: UpdateUserRoleInput,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    let filters: FindOptionsWhere<User> = {};
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = { office: { id: user.office.id } };
    //   updateUserRoleInput.officeId = user.office.id;
    // }
    // if (user.role.some((r) => r === Role.MANAGER)) {
    //   filters = { department: { id: user.department.id } };
    //   updateUserRoleInput.officeId = user.office.id;
    //   updateUserRoleInput.departmentId = user.department.id;
    // }
    // if (user.role.some((r) => r === Role.SUPERVISOR)) {
    //   filters = { team: { id: user.team.id } };
    //   updateUserRoleInput.officeId = user.office.id;
    //   updateUserRoleInput.departmentId = user.department.id;
    //   updateUserRoleInput.teamId = user.department.id;
    // }

    return { id, filters };
  }

  public async forFindOneCustomer(currentUser: JWTPayload): Promise<number> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    return user.id as number;
  }

  public async forUpdate(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    let filters: FindOptionsWhere<User> = {};
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = { office: { id: user.office.id } };
    // }

    return { id, filters };
  }

  public async forUpdateCustomer(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    let filters: FindOptionsWhere<User> = {};
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = { office: { id: user.office.id } };
    // }
    // if (user.role.some((r) => r === Role.MANAGER)) {
    //   filters = { office: { id: user.office.id } };
    // }
    // if (user.role.some((r) => r === Role.SUPERVISOR)) {
    //   filters = { office: { id: user.office.id } };
    // }
    // if (user.role.some((r) => r === Role.AGENT)) {
    //   filters = { customerRelations: { user: { id: user.id } } };
    // }

    return { id, filters };
  }

  public async forRemove(
    currentUser: JWTPayload,
    ids: number[],
  ): Promise<{ ids: number[]; filters: FindOptionsWhere<User> }> {
    const user = await this.findUser(currentUser);
    await this.chekCompanyInfo(user);

    const filters: FindOptionsWhere<User> = {};
    // if (user.role.some((r) => r === Role.ADMIN)) {
    //   filters = { office: { id: user.office.id } };
    // }

    return { ids, filters };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async chekCompanyInfo(user: User): Promise<void> {
    // if (
    //   user.role.some((r) => r === Role.SUPER) &&
    //   (user.office || user.department || user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user cannot have an office, department or team.',
    //   );
    // }
    // if (
    //   user.role.some((r) => r === Role.PRINCIPAL) &&
    //   (user.office || user.department || user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user cannot have an office, department or team.',
    //   );
    // }
    // if (
    //   user.role.some((r) => r === Role.ADMIN) &&
    //   (!user.office || user.department || user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user does not have an office or has a department or team.',
    //   );
    // }
    // if (
    //   user.role.some((r) => r === Role.MANAGER) &&
    //   (!user.office || !user.department || user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user does not have an office or department or has a team.',
    //   );
    // }
    // if (
    //   user.role.some((r) => r === Role.SUPERVISOR) &&
    //   (!user.office || !user.department || !user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user does not have an office or department or team.',
    //   );
    // }
    // if (
    //   user.role.some((r) => r === Role.AGENT) &&
    //   (!user.office || !user.department || !user.team)
    // ) {
    //   throw new ForbiddenResourceError(
    //     'This user does not have an office or department or team.',
    //   );
    // }
    // if (user.role.some((r) => r === Role.USER) && !user.office) {
    //   throw new ForbiddenResourceError('This user does not have an office.');
    // }
    return;
  }

  private async findUser(currentUser: JWTPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: currentUser.sub },
      relations: {
        //office: true, sucursal: true, department: true, team: true
      },
    });
    return user as User;
  }

  private async chekCompanyInfoOfUserToBeCreated(
    createUserInput: CreateUserInput,
  ) {
    if (
      createUserInput.role.some(
        (r) => r == Role.SUPER || r == Role.PRINCIPAL,
      ) &&
      (createUserInput.officeId ||
        createUserInput.departmentId ||
        createUserInput.teamId)
    ) {
      throw new BadRequestError(
        'This user cannot have an office, department or team id.',
      );
    }
    if (
      createUserInput.role.some((r) => r === Role.ADMIN) &&
      (!createUserInput.officeId ||
        createUserInput.departmentId ||
        createUserInput.teamId)
    ) {
      throw new BadRequestError(
        'This user does not have an office or has a department or team.',
      );
    }
    if (
      createUserInput.role.some((r) => r === Role.MANAGER) &&
      (!createUserInput.officeId ||
        !createUserInput.departmentId ||
        createUserInput.teamId)
    ) {
      throw new BadRequestError(
        'This user does not have an office or department or has a team.',
      );
    }
    // if (
    //   createUserInput.role.some((r) => r === Role.SUPERVISOR) &&
    //   (!createUserInput.officeId ||
    //     !createUserInput.departmentId ||
    //     !createUserInput.teamId)
    // ) {
    //   throw new BadRequestError(
    //     'This user does not have an office or department or team.',
    //   );
    // }
    if (
      createUserInput.role.some((r) => r === Role.AGENT) &&
      (!createUserInput.officeId ||
        !createUserInput.departmentId ||
        !createUserInput.teamId)
    ) {
      throw new BadRequestError(
        'This user does not have an office or department or team.',
      );
    }
    if (
      createUserInput.role.some((r) => r === Role.USER) &&
      !createUserInput.officeId
    ) {
      throw new BadRequestError('This user does not have an office.');
    }
    return;
  }

  private constructCreateUserTree() {
    this.createUserTree.set(Role.SUPER, [
      Role.SUPER,
      Role.PRINCIPAL,
      Role.ADMIN,
      Role.MANAGER,
      Role.SUPERVISOR,
      Role.AGENT,
      Role.USER,
    ]);
    this.createUserTree.set(Role.PRINCIPAL, [
      Role.PRINCIPAL,
      Role.ADMIN,
      Role.MANAGER,
      Role.SUPERVISOR,
      Role.AGENT,
      Role.USER,
    ]);
    this.createUserTree.set(Role.ADMIN, [
      Role.ADMIN,
      Role.MANAGER,
      Role.SUPERVISOR,
      Role.AGENT,
      Role.USER,
    ]);
  }
  validateRoleToCreateUser(roleUser: Role, roleToCreate: Role): boolean {
    return this.createUserTree.get(roleUser)?.includes(roleToCreate) || false;
  }
}
