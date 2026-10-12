import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { EnvironmentVariables } from './environment-variables';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Config } from './config-resource/entities/config.entity';
import { ConfigStatus } from './config-resource/enums/config-status.enum';

import { ConfigResourceService } from './config-resource/services/config-resource.service';
import { RoleGuardEntity } from '../../modules/role-guard-resource/entities/role-guard.entity';
import { RoleGuardService } from '../../modules/role-guard-resource/services/role-guard.service';

/**
 * Configuración en dos niveles: primero los grupos activos de la tabla
 * `config` (editables desde el frontend) y después el `.env`. También da
 * acceso a los permisos guardados por operación (`role-guard-resource`).
 */
@Injectable()
export class ConfigService extends NestConfigService<EnvironmentVariables> {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly configResourceService: ConfigResourceService,
    private readonly roleGuardService: RoleGuardService,
  ) {
    super();
  }

  /**
   * Como `get`, pero consulta la tabla `config` en lugar del mapa en memoria.
   * Si ningún grupo activo tiene la clave con valor, lee el `.env`.
   */
  async getAsync<T = any>(
    propertyPath: keyof EnvironmentVariables,
  ): Promise<T | undefined> {
    const conf = await this.manager
      .createQueryBuilder(Config, 'config')
      .where(`COALESCE(config.values->>CAST(:key AS text), '') <> ''`, {
        key: propertyPath,
      })
      .andWhere('config.configStatus = :status', {
        status: ConfigStatus.ENABLED,
      })
      .getOne();
    if (conf) {
      return conf.values[propertyPath] as T;
    }
    return super.get(propertyPath);
  }

  /**
   * Valor de la clave en los grupos activos (mapa en memoria) o, si no está,
   * en el `.env`. Solo una cadena vacía (o nulo) en la tabla cuenta como
   * ausente: `false` y `0` son valores.
   */
  get<T = any>(propertyPath: keyof EnvironmentVariables): T | undefined {
    const val = this.configResourceService.getVal(propertyPath);
    return (val as T) ?? super.get(propertyPath);
  }

  /** Cambia cada vez que se guarda la configuración */
  getConfigVersion(): number {
    return this.configResourceService.version;
  }

  /**
   * Registra una operación (query, mutación o suscripción) en la tabla de
   * permisos si aún no está; sin `roles`, así que manda el código.
   */
  async saveQueryOrEndPointURL(
    queryOrEndPointURL: string,
    type: string,
    description = '',
  ): Promise<RoleGuardEntity | undefined> {
    const roleGuardEntity: RoleGuardEntity = {
      queryOrEndPointURL,
      type,
      description,
    };
    return this.roleGuardService.create(roleGuardEntity);
  }

  /** Fila de permisos de una operación, de la lista en memoria. */
  getRoleGuard(queryOrEndPointURL: string): RoleGuardEntity | undefined {
    return this.roleGuardService.getRoleGuard(queryOrEndPointURL);
  }
}
