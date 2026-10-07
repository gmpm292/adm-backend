import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { CreateConfigInput } from '../dto/create-config.input';
import { UpdateConfigInput } from '../dto/update-config.input';

import {
  backendConfigurations,
  SECRET_CONFIG_KEYS,
  SECRET_MASK,
} from '../backend-configurations/backend-configurations.helper';
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
  // Sube cada vez que se recargan los grupos: quien guarda objetos construidos
  // con la configuración (transporte de correo...) sabe así que debe rehacerlos
  private _version = 0;
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

  async find(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind({ options });
  }

  async findOne(id: number): Promise<Config> {
    const filters: FindOptionsWhere<Config> = { id };
    return super.baseFindOneByFilters({ filters });
  }

  async update(
    id: number,
    updateConfigInput: UpdateConfigInput,
  ): Promise<Config> {
    const data = { ...updateConfigInput };
    if (data.values) {
      // Si un secreto llega enmascarado es que no se tocó: se conserva
      const current = await this.findOne(id);
      data.values = Object.fromEntries(
        Object.entries(data.values).map(([key, value]) => [
          key,
          value === SECRET_MASK ? current.values?.[key] : value,
        ]),
      );
    }
    const updated = await super.baseUpdate({ id, data });
    await this.initMap();
    return updated;
  }

  async remove(ids: number[]): Promise<Config[]> {
    const removed = await super.baseDeleteMany({ ids, softRemove: false });
    await this.initMap();
    return removed;
  }

  /** Copia para la API con los secretos enmascarados */
  maskSecrets(config: Config): Config {
    if (!config?.values) return config;
    const values = Object.fromEntries(
      Object.entries(config.values).map(([key, value]) => [
        key,
        SECRET_CONFIG_KEYS.includes(key) && value !== '' && value != null
          ? SECRET_MASK
          : value,
      ]),
    );
    return { ...config, values };
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
          data.description != config.description ||
          data.category != config.category ||
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
              //configStatus: config.configStatus,
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

  /** Recarga los grupos activos: los desactivados o eliminados dejan de valer */
  async initMap() {
    const _vars = await this.configRepository.find({
      where: {
        configStatus: ConfigStatus.ENABLED,
      },
    });
    this._Map_Vars.clear();
    _vars.forEach((s) => {
      const { group, ...rest } = s;
      this._Map_Vars.set(group, rest);
    });
    this._version++;
  }

  get version() {
    return this._version;
  }

  getGroup(group: string) {
    return this._Map_Vars.get(group);
  }

  getKeyInGroup(group: string, key: string) {
    return this._Map_Vars.get(group)?.values[key];
  }

  getVal(key: string) {
    for (const val of this._Map_Vars.values()) {
      if (val.configStatus == ConfigStatus.ENABLED && val.values[key])
        return val.values[key];
    }
    return null;
  }
}
