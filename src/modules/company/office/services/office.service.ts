/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { CreateOfficeInput } from '../dto/create-office.input';
import { UpdateOfficeInput } from '../dto/update-office.input';
import { BaseService } from '../../../../core/services/base.service';
import { Office } from '../entities/co_office.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { Business } from '../../business/entities/co_business.entity';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { DepartmentService } from '../../department/services/department.service';
import { TeamService } from '../../team/services/team.service';
import { UsersService } from '../../../users/services/users.service';

@Injectable()
export class OfficeService extends BaseService<Office> {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    @InjectRepository(Office)
    private officeRepository: Repository<Office>,
    private userService: UsersService,
    private departmentService: DepartmentService,
    private teamService: TeamService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(officeRepository);
  }

  async create(
    createOfficeInput: CreateOfficeInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office> {
    const { businessId, address, description, name, officeType } =
      createOfficeInput;
    const office = {
      business: { id: businessId } as Business,
      officeType: officeType,
      name: name,
      description: description,
      address: address,
    } as Office;

    return super.baseCreate({
      data: office,
      uniqueFields: ['name'],
      cu,
      scopes,
      manager,
    });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
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
    const { businessId, ...rest } = updateOfficeInput;
    const office = await super.baseFindOne({ id, cu, scopes, manager });
    if (!office) {
      throw new NotFoundError();
    }
    const data: DeepPartial<Office> = {
      ...office,
      business: businessId ? ({ id: businessId } as Business) : office.business,
      ...rest,
    };
    return super.baseUpdate({ id, data, cu, scopes, manager });
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Office[]> {
    const offices = await super.baseFindByIds({
      ids,
      relationsToLoad: {
        users: true,
        departments: {
          teams: true,
        },
      },
      cu,
      scopes,
      manager,
    });

    if (offices.length === 0) {
      throw new NotFoundError('No offices found');
    }

    await Promise.all([
      ...offices.flatMap((office) =>
        office.users?.length
          ? this.userService.remove(
              office.users.map((u) => u.id) as Array<number>,
              undefined,
              cu as JWTPayload,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
      ...offices.flatMap((office) =>
        office.departments?.length
          ? this.departmentService.remove(
              office.departments.map((d) => d.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    ]);

    return super.baseDeleteMany({
      ids: offices.map((o) => o.id) as Array<number>,
      cu,
      scopes,
      softRemove: true,
      manager,
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
      relationsToLoad: {
        users: true,
        departments: {
          teams: true,
        },
      },
      cu,
      scopes,
      withDeleted: true,
      manager,
    });

    const deletedOffices = offices.filter((o) => o.deletedAt);
    if (deletedOffices.length === 0) return 0;

    await Promise.all([
      ...deletedOffices.flatMap((office) =>
        office.users?.filter((u) => u.deletedAt)?.length
          ? this.userService.restore(
              office.users.filter((u) => u.deletedAt).map((u) => u.id),
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
      ...deletedOffices.flatMap((office) =>
        office.departments?.filter((d) => d.deletedAt)?.length
          ? this.departmentService.restore(
              office.departments
                .filter((d) => d.deletedAt)
                .map((d) => d.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    ]);

    return super.baseRestoreDeletedMany({
      ids: deletedOffices.map((o) => o.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
