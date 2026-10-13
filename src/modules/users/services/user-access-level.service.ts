/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

import { ChangePasswordByEmailInput } from '../dto/change-password-by-email.input';
import { Role } from '../../../core/enums/role.enum';
import { User } from '../entities/user.entity';
import {
  ListFilter,
  ListOptions,
} from '../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { CreateUserInput } from '../dto/create-user.input';
import { ForbiddenResourceError } from '../../../core/errors/appErrors/ForbiddenResourceError';

/**
 * Ajustes previos de `UsersResolver` según quién hace la petición (método
 * `forX` para cada operación X). La administración de usuarios es solo para
 * SUPER, pero `users` y `user` también los leen los mandos (para vincular
 * cuentas a trabajadores o clientes): cada uno solo ve las de su lugar.
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

  /**
   * Limita el listado al lugar de quien pregunta. Los filtros del cliente ya
   * llegan agrupados (`@Opts`), así que un OR suyo no salta este AND.
   */
  public async forFind(
    currentUser: JWTPayload,
    options?: ListOptions,
  ): Promise<ListOptions> {
    const place = this.placeOf(currentUser);
    const filters: ListFilter[] = [...(options?.filters ?? [])];
    if (place) {
      filters.push({
        property: `${place.relation}.id`,
        operator: ConditionalOperator.EQUAL,
        value: String(place.id),
      });
    }
    return { ...options, filters } as ListOptions;
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

  /** Un usuario, solo si está en el lugar de quien pregunta. */
  public async forFindOne(
    currentUser: JWTPayload,
    id: number,
  ): Promise<{ id: number; filters: FindOptionsWhere<User> }> {
    const place = this.placeOf(currentUser);
    return {
      id,
      filters: place ? { [place.relation]: { id: place.id } } : {},
    };
  }

  /**
   * Hasta dónde ve cuentas cada rol: SUPER todas; PRINCIPAL su empresa; ADMIN
   * su oficina; MANAGER su departamento; SUPERVISOR su equipo. Sin ese dato
   * en el token no ve ninguna.
   */
  private placeOf(currentUser: JWTPayload): {
    relation: 'business' | 'office' | 'department' | 'team';
    id: number;
  } | null {
    const roles = currentUser.role ?? [];
    if (roles.includes(Role.SUPER)) return null;
    const levels = [
      [Role.PRINCIPAL, 'business', currentUser.businessId],
      [Role.ADMIN, 'office', currentUser.officeId],
      [Role.MANAGER, 'department', currentUser.departmentId],
      [Role.SUPERVISOR, 'team', currentUser.teamId],
    ] as const;
    const level = levels.find(([role]) => roles.includes(role));
    if (!level || !level[2]) {
      throw new ForbiddenResourceError(
        'No tienes acceso a las cuentas de usuario',
      );
    }
    return { relation: level[1], id: level[2] };
  }

  // forUpdateUserRole y forRemove devuelven filtros vacíos: esas operaciones
  // son solo para SUPER.

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
