import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { EnvironmentVariables } from './environment-variables';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Config } from './config-resource/entities/config.entity';

import { ConfigResourceService } from './config-resource/services/config-resource.service';

@Injectable()
export class ConfigService extends NestConfigService<EnvironmentVariables> {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly configResourceService: ConfigResourceService,
  ) {
    super();
  }

  async getAsync<T = any>(
    propertyPath: keyof EnvironmentVariables,
  ): Promise<T | undefined> {
    const conf = await this.manager
      .createQueryBuilder(Config, 'config')
      .where(`config.values->>'${propertyPath}' IS NOT NULL`)
      .getOne();
    if (conf) {
      return conf.values[propertyPath] as T;
    }
    return super.get(propertyPath);
  }

  get<T = any>(propertyPath: keyof EnvironmentVariables): T | undefined {
    const val = this.configResourceService.getVal(propertyPath);
    return (val as T) ?? super.get(propertyPath);
  }

  getVarsGroup(group: string) {
    return this.configResourceService.getGroup(group);
  }

  getVarInGroup(groupKey: string, key: string) {
    return this.configResourceService.getKeyInGroup(groupKey, key);
  }

  resolveVar(varKey: string, groupKey?: string): unknown {
    return groupKey
      ? (this.getVarInGroup(groupKey, varKey) ??
          super.get(varKey as keyof EnvironmentVariables))
      : super.get(varKey as keyof EnvironmentVariables);
  }

  //TODO: Implement the methods
  // async saveQueryOrEndPointURL(
  //   queryOrEndPointURL: string,
  //   type: string,
  //   description = '',
  // ): Promise<RoleGuardEntity> {
  //   const roleGuardEntity: RoleGuardEntity = {
  //     queryOrEndPointURL,
  //     type,
  //     description,
  //   };
  //   return this.roleGuardService.create(roleGuardEntity);
  // }

  // getRoleGuard(queryOrEndPointURL: string): RoleGuardEntity {
  //   return this.roleGuardService.getRoleGuard(queryOrEndPointURL);
  // }
}
