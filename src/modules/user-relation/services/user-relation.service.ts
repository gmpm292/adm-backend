import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ObjectType } from 'typeorm';
import { UserRelation } from '../entities/user-relation.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class EntityRelationService {
  constructor(
    @InjectRepository(UserRelation)
    private readonly repo: Repository<UserRelation>,
    private readonly dataSource: DataSource,
  ) {}

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
