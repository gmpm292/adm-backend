import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { CreateConfigInput } from '../dto/create-config.input';
import { UpdateConfigInput } from '../dto/update-config.input';

import { backendConfigurations } from '../backend-configurations/backend-configurations.helper';
import { Config } from '../entities/config.entity';
import { BaseService } from '../../../../core/services/base.service';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { ConfigVisibility } from '../enums/config-visibility.enum';
import { ConfigStatus } from '../enums/config-status.enum';

export type SettingMapType = Omit<Config, 'group'>;
@Injectable()
export class ConfigResourceService
  extends BaseService<Config>
  implements OnModuleInit
{
  private _Map_Vars: Map<string, SettingMapType> = new Map();
  constructor(
    @InjectRepository(Config) private configRepository: Repository<Config>,
    @InjectEntityManager()
    private readonly mannager: EntityManager,
  ) {
    super(configRepository);
  }
  async onModuleInit() {
    await this.syncBackendConfigurationsAndDB();
    await this.initMap();
  }

  async create(createConfigInput: CreateConfigInput): Promise<Config> {
    const created = await super.baseCreate({
      data: createConfigInput,
      uniqueFields: ['group'],
    });
    await this.initMap();
    return created;
  }

  async find(
    options?: ListOptions /*user?: JWTPayload*/,
  ): Promise<ListSummary> {
    if (!options || !options.filters) {
      options = { ...options, filters: [] } as ListOptions;
    }
    //TODO
    // if (user && !user?.role.some((r) => r == Role.SUPER)) {
    //   options.filters.push({
    //     property: 'configVisibility',
    //     operator: ConditionalOperator.EQUAL,
    //     value: String(ConfigVisibility.PUBLIC_ENT),
    //     logicalOperator: LogicalOperator.AND,
    //   } as ListFilter);
    // }
    return await super.baseFind({ options });
  }

  async findOne(id: number /*user?: JWTPayload*/): Promise<Config> {
    const filters: FindOptionsWhere<Config> = { id };
    // if (!user?.role.some((r) => r == Role.SUPER)) {
    //   filters = { ...filters, configVisibility: ConfigVisibility.PUBLIC_ENT };
    // }
    return super.baseFindOneByFilters({ filters });
  }

  async update(
    id: number,
    updateConfigInput: UpdateConfigInput,
  ): Promise<Config> {
    const updated = await super.baseUpdate({ id, data: updateConfigInput });
    await this.initMap();
    return updated;
  }

  async remove(ids: number[]): Promise<Config[]> {
    return super.baseDeleteMany({ ids, softRemove: false });
  }

  async syncBackendConfigurationsAndDB() {
    let dbConfig = (
      await this.find({
        skip: 0,
      })
    ).data as Array<Config>;

    for (const config of backendConfigurations) {
      const data = dbConfig.find((c) => c.group == config.group);
      //delete processed element.
      dbConfig = dbConfig.filter((c) => c.id != data?.id);

      if (!data) {
        await this.create(config);
      } else {
        const storageKeys = Object.keys(data.values).sort();
        const configKeys = Object.keys(config.values).sort();
        if (
          JSON.stringify(storageKeys) != JSON.stringify(configKeys) ||
          data.configVisibility != config.configVisibility ||
          data.configStatus != config.configStatus
        ) {
          //delete from storageConf the keys that not in new configKeys
          storageKeys.forEach((e) => {
            if (!configKeys.find((c) => c == e)) delete data.values[e];
          });

          const values = { ...config.values, ...data.values };
          if (data.id !== undefined) {
            await this.update(data.id, {
              values,
              id: data.id,
              category: config.category,
              description: config.description,
              configVisibility: config.configVisibility,
              configStatus: config.configStatus,
            });
          }
        }
      }
    }
    const toRemove = dbConfig.filter(
      (e) => e.configVisibility == ConfigVisibility.PRIVATE,
    );
    const idsToRemove = toRemove
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined);
    if (idsToRemove.length > 0) await this.remove(idsToRemove);
  }

  async initMap() {
    console.log('Initializing vars map.');
    const _vars = await this.configRepository.find({
      where: {
        configStatus: ConfigStatus.ENABLED,
      },
    });
    _vars.forEach((s) => {
      const { group, ...rest } = s;
      this._Map_Vars.set(group, rest);
    });
    console.log('Vars map initialized!, ', _vars.length);
  }

  getGroup(group: string) {
    return this._Map_Vars.get(group);
  }

  getKeyInGroup(group: string, key: string) {
    return this._Map_Vars.get(group)?.values[key];
  }

  getVal(key: string) {
    for (const val of this._Map_Vars.values()) {
      if (val.values[key]) return val.values[key];
    }
    return null;
  }
}
