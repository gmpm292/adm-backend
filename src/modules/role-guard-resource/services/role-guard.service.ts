import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleGuardInput } from '../dto/create-role-guard.input';
import { UpdateRoleGuardInput } from '../dto/update-role-guard.input';

import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { BaseService } from '../../../core/services/base.service';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { RoleGuardEntity } from '../entities/role-guard.entity';
import { Role } from '../../../core/enums/role.enum';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';

const RESOLVER_NAME_METADATA = 'graphql:resolver_name';

/** Lo que dice el código de una operación: si pasa por `RoleGuard` y con qué `@Roles` */
interface CodeRoles {
  usesRoleGuard: boolean;
  roles: Role[] | null;
}

export type RoleGuardView = RoleGuardEntity & {
  usesRoleGuard: boolean;
  codeRoles: Role[] | null;
};

/**
 * Permisos por operación. Una fila con `roles` sustituye los `@Roles` del
 * código; con `roles` nulo manda el código. Solo tiene efecto en las
 * operaciones que pasan por `RoleGuard`.
 */
@Injectable()
export class RoleGuardService
  extends BaseService<RoleGuardEntity>
  implements OnModuleInit, OnApplicationBootstrap
{
  private roleGuardList: Array<RoleGuardEntity> = [];
  private codeRoles = new Map<string, CodeRoles>();

  constructor(
    @InjectRepository(RoleGuardEntity)
    private roleGuardRepository: Repository<RoleGuardEntity>,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {
    super(roleGuardRepository);
  }

  async onModuleInit() {
    await this.loadRoleGuardEntity();
  }

  onApplicationBootstrap() {
    this.loadCodeRoles();
  }

  getRoleGuard(queryOrEndPointURL: string): RoleGuardEntity | undefined {
    return this.roleGuardList.find(
      (rg) => rg.queryOrEndPointURL == queryOrEndPointURL,
    );
  }

  /** Roles que se aplican de verdad: los guardados o, si no hay, los del código */
  getEffectiveRoles(operation: string): CodeRoles {
    const code = this.codeRoles.get(operation) ?? {
      usesRoleGuard: false,
      roles: null,
    };
    const saved = this.getRoleGuard(operation)?.roles;
    return { usesRoleGuard: code.usesRoleGuard, roles: saved ?? code.roles };
  }

  async create(
    createRoleGuardInput: CreateRoleGuardInput,
  ): Promise<RoleGuardEntity | undefined> {
    const cuantity = (
      await this.findInDB({
        take: 0,
        filters: [
          {
            property: 'queryOrEndPointURL',
            operator: ConditionalOperator.EQUAL,
            value: createRoleGuardInput.queryOrEndPointURL,
          },
        ],
      })
    ).totalCount;
    if (cuantity == 0)
      return super.baseCreate({
        data: createRoleGuardInput,
        uniqueFields: ['queryOrEndPointURL'],
      });
    return undefined;
  }

  async findInDB(options?: ListOptions): Promise<ListSummary> {
    const result = await super.baseFind({ options });
    return {
      ...result,
      data: (result.data as RoleGuardEntity[]).map((rg) => this.withCode(rg)),
    };
  }

  async findOneInDB(id: number): Promise<RoleGuardView> {
    return this.withCode(await super.baseFindOne({ id }));
  }

  async update(
    id: number,
    updateRoleGuardInput: UpdateRoleGuardInput,
  ): Promise<RoleGuardView> {
    const { roles, description } = updateRoleGuardInput;
    const current = await super.baseFindOne({ id });
    if (roles !== undefined) {
      if (!this.codeRoles.get(current.queryOrEndPointURL)?.usesRoleGuard) {
        throw new BadRequestError(
          'Esta operación no comprueba roles: cambiarlos no tendría efecto',
        );
      }
      if (roles !== null && !roles.length) {
        throw new BadRequestError(
          'Elige al menos un rol, o vuelve a los roles del código',
        );
      }
      if (roles !== null && !roles.includes(Role.SUPER)) {
        throw new BadRequestError(
          'El superadministrador debe conservar el acceso',
        );
      }
    }
    // Con `roles` nulo vuelven a mandar los `@Roles` del código
    await super.baseUpdate({
      id,
      data: {
        ...(roles !== undefined && { roles: roles as Role[] }),
        ...(description !== undefined && { description }),
      },
    });
    await this.loadRoleGuardEntity();
    return this.findOneInDB(id);
  }

  async remove(ids: number[]): Promise<RoleGuardEntity[]> {
    return super.baseDeleteMany({ ids });
  }

  private withCode(rg: RoleGuardEntity): RoleGuardView {
    const code = this.codeRoles.get(rg.queryOrEndPointURL);
    return {
      ...rg,
      usesRoleGuard: code?.usesRoleGuard ?? false,
      codeRoles: code?.roles ?? null,
    };
  }

  private async loadRoleGuardEntity() {
    this.roleGuardList = await this.roleGuardRepository.find();
  }

  /** Recorre los resolvers y anota los `@Roles` y guardas de cada operación */
  private loadCodeRoles() {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as object | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance) as object;
      const classGuards = this.guardNames(instance.constructor);
      for (const method of this.metadataScanner.getAllMethodNames(prototype)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        const handler = (prototype as Record<string, Function>)[method];
        const operation = this.reflector.get<string | undefined>(
          RESOLVER_NAME_METADATA,
          handler,
        );
        if (!operation) continue;
        this.codeRoles.set(operation, {
          usesRoleGuard: [...classGuards, ...this.guardNames(handler)].includes(
            'RoleGuard',
          ),
          roles:
            this.reflector.get<Role[] | undefined>('roles', handler) ?? null,
        });
      }
    }
  }

  // Por nombre: importar `RoleGuard` aquí crearía una dependencia circular
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private guardNames(target: Function): string[] {
    const guards =
      this.reflector.get<Array<{ name?: string }>>(GUARDS_METADATA, target) ??
      [];
    return guards.map((guard) => guard?.name ?? '');
  }
}
