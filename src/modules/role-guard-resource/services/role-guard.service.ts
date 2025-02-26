/* eslint-disable @typescript-eslint/no-floating-promises */
import { Injectable, OnModuleInit } from '@nestjs/common';
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
import { RoleGuardEntity } from '../../../core/entities/role-guard.entity';

@Injectable()
export class RoleGuardService
  extends BaseService<RoleGuardEntity>
  implements OnModuleInit
{
  private roleGuardList: Array<RoleGuardEntity> = [];

  constructor(
    @InjectRepository(RoleGuardEntity)
    private roleGuardRepository: Repository<RoleGuardEntity>,
  ) {
    super(roleGuardRepository);
  }
  async onModuleInit() {
    await this.loadRoleGuardEntity();
  }

  getRoleGuard(queryOrEndPointURL: string): RoleGuardEntity | undefined {
    return this.roleGuardList.find(
      (rg) => rg.queryOrEndPointURL == queryOrEndPointURL,
    );
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
      return super.baseCreate(createRoleGuardInput, ['queryOrEndPointURL']);
    return undefined;
  }

  async findInDB(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind(options as ListOptions);
  }

  async findOneInDB(id: number): Promise<RoleGuardEntity> {
    return super.baseFindOne(id);
  }

  async update(
    id: number,
    updateRoleGuardInput: UpdateRoleGuardInput,
  ): Promise<RoleGuardEntity> {
    const roleGuard = await super.baseUpdate(id, updateRoleGuardInput);
    this.loadRoleGuardEntity();
    return roleGuard;
  }

  async remove(ids: number[]): Promise<RoleGuardEntity[]> {
    return super.baseDeleteMany(ids);
  }

  private async loadRoleGuardEntity() {
    this.roleGuardList = [];
    const roleGuard = await this.findInDB({ skip: 0 });
    if (roleGuard.totalCount > 0) {
      for (const rg of roleGuard.data as Array<RoleGuardEntity>) {
        this.roleGuardList.push(rg);
      }
    }
    console.log(`Load ${roleGuard.totalCount} role guard entity`);
  }
}
