import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateOfficeInput } from '../dto/create-office.input';
import { UpdateOfficeInput } from '../dto/update-office.input';
import { BaseService } from '../../../../core/services/base.service';
import { Office } from '../entities/co_office.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ForbiddenResourceError } from '../../../../core/errors/appErrors/ForbiddenResourceError';
import { Business } from '../../business/entities/co_business.entity';
import { Department } from '../../department/entities/co_department.entity';
import { User } from '../../../users/entities/user.entity';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import {
  assertNotInUse,
  assertUniqueName,
  cleanName,
  cleanText,
  plural,
} from '../../helpers/company-structure.helper';

@Injectable()
export class OfficeService extends BaseService<Office> {
  constructor(
    @InjectRepository(Office)
    private officeRepository: Repository<Office>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(officeRepository);
  }

  private managerOf(manager?: EntityManager): EntityManager {
    return manager ?? this.officeRepository.manager;
  }

  private async findBusiness(
    businessId: number,
    manager?: EntityManager,
  ): Promise<Business> {
    const business = await this.managerOf(manager).findOne(Business, {
      where: { id: businessId },
    });
    if (!business) throw new NotFoundError('Empresa no encontrada');
    return business;
  }

  async create(
    createOfficeInput: CreateOfficeInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office> {
    const { businessId, officeType } = createOfficeInput;
    const name = cleanName(createOfficeInput.name);
    // Quien pertenece a una empresa solo crea oficinas en la suya.
    if (cu?.businessId && cu.businessId !== businessId) {
      throw new ForbiddenResourceError(
        'Solo puedes crear oficinas en tu empresa',
      );
    }
    const business = await this.findBusiness(businessId, manager);

    await assertUniqueName(
      this.managerOf(manager),
      Office,
      name,
      { business: { id: businessId } },
      `"${business.name}" ya tiene una oficina llamada "${name}"`,
    );

    // `description` y `address` son columnas obligatorias: vacías, no nulas.
    const office = {
      business: { id: businessId } as Business,
      officeType,
      name,
      description: cleanText(createOfficeInput.description) ?? '',
      address: cleanText(createOfficeInput.address) ?? '',
    } as Office;

    const created = await super.baseCreate({
      data: office,
      cu,
      scopes,
      manager,
    });
    return this.findOne(created.id as number, cu, scopes, manager);
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const sorts = options?.sorts?.length
      ? options.sorts
      : [{ property: 'name', direction: SortDirection.ASC }];

    return await super.baseFind({
      options: { ...(options ?? { skip: 0, take: 10 }), sorts },
      relationsToLoad: ['business', 'departments'],
      cu,
      scopes,
      manager,
    });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        business: true,
        departments: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateOfficeInput: UpdateOfficeInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office> {
    const office = await this.findOne(id, cu, scopes, manager);
    const data: Partial<Office> = {};

    const { businessId } = updateOfficeInput;
    if (businessId && businessId !== office.business?.id) {
      // Sus departamentos y usuarios seguirían apuntando a la otra empresa.
      throw new BadRequestError(
        'Una oficina no puede cambiarse de empresa: crea otra en la empresa nueva',
      );
    }

    if (updateOfficeInput.name !== undefined) {
      data.name = cleanName(updateOfficeInput.name);
      await assertUniqueName(
        this.managerOf(manager),
        Office,
        data.name,
        { business: { id: office.business?.id } },
        `La empresa ya tiene una oficina llamada "${data.name}"`,
        id,
      );
    }
    if (updateOfficeInput.officeType) {
      data.officeType = updateOfficeInput.officeType;
    }
    for (const field of ['description', 'address'] as const) {
      if (updateOfficeInput[field] !== undefined) {
        data[field] = cleanText(updateOfficeInput[field]) ?? '';
      }
    }

    if (Object.keys(data).length > 0) {
      await super.baseUpdate({ id, data, cu, scopes, manager });
    }
    return this.findOne(id, cu, scopes, manager);
  }

  /** Solo se elimina una oficina vacía: sin departamentos ni usuarios. */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office[]> {
    const offices = await super.baseFindByIds({ ids, cu, scopes, manager });

    if (offices.length === 0) {
      throw new NotFoundError('Oficina no encontrada');
    }

    await assertNotInUse(this.managerOf(manager), offices, [
      {
        entity: Department,
        where: (id) => ({ office: { id } }),
        label: plural('departamento', 'departamentos'),
      },
      {
        entity: User,
        where: (id) => ({ office: { id } }),
        label: plural('usuario', 'usuarios'),
      },
    ]);

    return super.baseDeleteMany({
      ids: offices.map((o) => o.id) as number[],
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const offices = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedOffices = offices.filter((o) => o.deletedAt);
    if (deletedOffices.length === 0) return 0;

    if (deletedOffices.some((o) => !o.business || o.business.deletedAt)) {
      throw new BadRequestError(
        'La empresa de esta oficina está eliminada: restáurala primero',
      );
    }

    return super.baseRestoreDeletedMany({
      ids: deletedOffices.map((o) => o.id) as number[],
      cu,
      scopes,
      manager,
    });
  }
}
