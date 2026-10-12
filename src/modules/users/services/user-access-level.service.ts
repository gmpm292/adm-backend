/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

import { ChangePasswordByEmailInput } from '../dto/change-password-by-email.input';
import { Role } from '../../../core/enums/role.enum';
import { User } from '../entities/user.entity';
import { ListOptions } from '../../../core/graphql/remote-operations';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { CreateUserInput } from '../dto/create-user.input';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';

/**
 * Ajustes previos de `UsersResolver` según quién hace la petición (método
 * `forX` para cada operación X). La administración de usuarios es solo para
 * SUPER, así que los métodos de búsqueda no añaden filtros.
 */
@Injectable()
export class UserAccessLevelService {
  private createUserTree: Map<Role, Role[]> = new Map();

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {
    this.constructCreateUserTree();
  }

  /** Quien no es SUPER solo puede cambiar su propia contraseña (su correo). */
  public async forChangePasswordByEmail(
    currentUser: JWTPayload,
    changePasswordByEmailInput: ChangePasswordByEmailInput,
  ): Promise<ChangePasswordByEmailInput> {
    const user = await this.findUser(currentUser);

    if (!user.role?.some((r) => r === Role.SUPER)) {
      changePasswordByEmailInput.email = user.email;
    }
    return changePasswordByEmailInput;
  }

  /** Garantiza `options.filters`; no añade filtros. */
  public async forFind(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListOptions> {
    if (!options || !options.filters) {
      options = { ...options, filters: [] } as ListOptions;
    }
    return options;
  }

  /**
   * Valida el alta: el lugar que exige el rol nuevo, que el primer rol de
   * quien crea pueda crear el primer rol pedido (`createUserTree`) y, si crea
   * SUPER o PRINCIPAL un rol inferior, que llegue la oficina.
   */
  public async forCreate(
    currentUser: JWTPayload,
    createUserInput: CreateUserInput,
  ): Promise<CreateUserInput> {
    const user = await this.findUser(currentUser);
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
    return createUserInput;
  }

  /** Siempre permite: la administración de usuarios es solo para SUPER. */
  public async forRequestPasswordChangeForAnotherUser(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentUser: JWTPayload,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userToChangePass: User,
  ): Promise<boolean> {
    return true;
  }

  // forFindOne, forUpdateUserRole y forRemove devuelven filtros vacíos: la
  // administración de usuarios es solo para SUPER.
  public async forFindOne(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    return { id, filters: {} };
  }

  public async forUpdateUserRole(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    return { id, filters: {} };
  }

  public async forRemove(
    currentUser: JWTPayload,
    ids: number[],
  ): Promise<{ ids: number[]; filters: FindOptionsWhere<User> }> {
    return { ids, filters: {} };
  }

  private async findUser(currentUser: JWTPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: currentUser.sub },
    });
    return user as User;
  }

  /**
   * Lugar que exige el rol del usuario nuevo: SUPER y PRINCIPAL sin oficina;
   * ADMIN oficina; MANAGER y departamento; SUPERVISOR y AGENT y equipo; USER
   * oficina.
   */
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
    if (
      createUserInput.role.some(
        (r) => r === Role.SUPERVISOR || r === Role.AGENT,
      ) &&
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

  /** Qué roles puede crear cada rol; los que no están no crean ninguno. */
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
