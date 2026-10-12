import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ObjectType } from 'typeorm';
import { UserRelation } from '../entities/user-relation.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Relaciones genéricas usuario ↔ registro de cualquier entidad (por nombre de
 * entidad e id). No está registrado como provider en ningún módulo.
 */
@Injectable()
export class EntityRelationService {
  constructor(
    @InjectRepository(UserRelation)
    private readonly repo: Repository<UserRelation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Relaciona un usuario con un registro. `entityType` puede ser el nombre de
   * la entidad o su clase.
   */
  async addRelation(
    entityType: string | ObjectType<any>,
    entityId: number,
    user: User,
    relationType?: string,
  ): Promise<UserRelation> {
    const typeName =
      typeof entityType === 'string'
        ? entityType
        : this.getEntityName(entityType);

    const relation = this.repo.create({
      entityType: typeName,
      entityId,
      user,
      relationType,
    });
    return await this.repo.save(relation);
  }

  /** Relaciones (con su usuario) de un registro concreto. */
  async getRelatedUsers(
    entityType: string | ObjectType<any>,
    entityId: number,
  ): Promise<UserRelation[]> {
    const typeName =
      typeof entityType === 'string'
        ? entityType
        : this.getEntityName(entityType);

    return await this.repo.find({
      where: { entityType: typeName, entityId },
      relations: ['user'],
    });
  }

  private getEntityName(entityClass: ObjectType<any>): string {
    const metadata = this.dataSource.getMetadata(entityClass);
    return metadata.targetName || metadata.name;
  }

  /** Relaciones de un usuario, opcionalmente solo de un tipo de entidad. */
  async getRelatedEntitiesForUser(
    userId: number,
    entityType?: string | ObjectType<any>,
  ): Promise<UserRelation[]> {
    const where: { user: { id: number }; entityType?: string } = {
      user: { id: userId },
    };

    if (entityType) {
      where.entityType =
        typeof entityType === 'string'
          ? entityType
          : this.getEntityName(entityType);
    }

    return await this.repo.find({
      where,
      relations: ['user'],
    });
  }
}
