/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, IsNull, ObjectLiteral, Repository } from 'typeorm';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { Role } from '../../../core/enums/role.enum';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { ListFilter } from '../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { Business } from '../../company/business/entities/co_business.entity';
import { Office } from '../../company/office/entities/co_office.entity';
import { Department } from '../../company/department/entities/co_department.entity';
import { Team } from '../../company/team/entities/co_team.entity';

@Injectable()
export class ScopedAccessService {
  public forBaseFindOne<Entity extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<Entity>,
    scopes: ScopedAccessEnum[] | undefined,
  ): FindOptionsWhere<Entity>[] {
    const filters: FindOptionsWhere<Entity>[] = [];
    const effectiveScopes =
      scopes ??
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // SUPER users or Scopes includes GENERAL, bypass all filters
    if (cu.role?.some((r) => r === Role.SUPER)) {
      return [{}]; // Empty filter means no restrictions
    }

    const entityMetadata = repository.metadata;

    // Check for common entity fields
    const hasBusinessId = entityMetadata.columns.some(
      (c) => c.propertyName === 'business',
    );
    const hasOfficeId = entityMetadata.columns.some(
      (c) => c.propertyName === 'office',
    );
    const hasDepartmentId = entityMetadata.columns.some(
      (c) => c.propertyName === 'department',
    );
    const hasTeamId = entityMetadata.columns.some(
      (c) => c.propertyName === 'team',
    );
    const hasCreatedBy = entityMetadata.columns.some(
      (c) => c.propertyName === 'createdBy',
    );
    const hasUpdatedBy = entityMetadata.columns.some(
      (c) => c.propertyName === 'updatedBy',
    );

    // GENERAL scope
    if (
      effectiveScopes.includes(ScopedAccessEnum.GENERAL) &&
      hasBusinessId &&
      hasOfficeId &&
      hasDepartmentId &&
      hasTeamId
    ) {
      filters.push({
        business: IsNull(),
        office: IsNull(),
        department: IsNull(),
        team: IsNull(),
      } as unknown as FindOptionsWhere<Entity>);
    }

    // PERSONAL scope (user's own entities)
    if (effectiveScopes.includes(ScopedAccessEnum.PERSONAL)) {
      if (hasCreatedBy || hasUpdatedBy) {
        filters.push({
          ...(hasCreatedBy && { createdBy: { id: cu.sub } }),
          ...(hasUpdatedBy && { updatedBy: { id: cu.sub } }),
        } as FindOptionsWhere<Entity>);
      }
    }

    // Hierarchical scopes
    let hierarchicalFilter = {};
    if (
      effectiveScopes.includes(ScopedAccessEnum.BUSINESS) &&
      hasBusinessId &&
      cu.businessId
    ) {
      hierarchicalFilter = {
        ...hierarchicalFilter,
        business: { id: cu.businessId },
      };
    }

    if (
      effectiveScopes.includes(ScopedAccessEnum.OFFICE) &&
      hasOfficeId &&
      cu.officeId
    ) {
      hierarchicalFilter = {
        ...hierarchicalFilter,
        office: { id: cu.officeId },
      };
    }

    if (
      effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT) &&
      hasDepartmentId &&
      cu.departmentId
    ) {
      hierarchicalFilter = {
        ...hierarchicalFilter,
        department: { id: cu.departmentId },
      };
    }

    if (
      effectiveScopes.includes(ScopedAccessEnum.TEAM) &&
      hasTeamId &&
      cu.teamId
    ) {
      hierarchicalFilter = {
        ...hierarchicalFilter,
        team: { id: cu.teamId },
      };
    }

    if (hierarchicalFilter) {
      filters.push(hierarchicalFilter);
    }

    // If no filters and user isn't SUPER, deny access
    if (filters.length === 0) {
      throw new UnauthorizedError(
        'Access denied: No valid scope filters could be applied',
      );
    }

    return filters;
  }

  /**
   * Applies filters based on allowed scopes and user roles.
   * @param cu Current user (JWTPayload) with multiple roles.
   * @param repository TypeORM repository of the entity.
   * @param scopes Allowed scopes for the operation (e.g., [ScopedAccessEnum.OFFICE, ScopedAccessEnum.PERSONAL]).
   * @returns Object with WHERE filters for TypeORM.
   */
  public async forBaseFind<T extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<T>,
    scopes?: ScopedAccessEnum[],
  ): Promise<ListFilter[]> {
    const filters: Array<ListFilter> = [];
    const effectiveScopes =
      scopes ??
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // If SUPER or Scopes includes GENERAL, no filters.
    if (cu.role?.some((r) => r === Role.SUPER)) return [];

    // Company filters
    const companyFilters = this.forBaseFindCompanyFilters(
      cu,
      repository,
      effectiveScopes,
    );
    if (companyFilters.filters?.length || 0 > 0) {
      filters.push(companyFilters);
    }

    // RELATED filters
    if (effectiveScopes.includes(ScopedAccessEnum.RELATED)) {
      await this.forBaseFindRelatedFilters(cu, repository, filters);
    }

    // If no applicable filters and user is not SUPER, deny access.
    if (filters.length === 0 && !cu.role.some((r) => r === Role.SUPER)) {
      throw new UnauthorizedError(
        'Access denied: You do not have permissions for this operation.',
      );
    }

    return filters;
  }

  private forBaseFindCompanyFilters<T extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<T>,
    scopes: ScopedAccessEnum[],
  ): ListFilter {
    // Create new filte
    const newFilter: ListFilter = {
      filters: [],
    } as unknown as ListFilter;

    // Check existing fields in the entity.
    const entityMetadata = repository.metadata;
    const hasBusinessId = entityMetadata.columns.some(
      (c) => c.propertyName === 'business',
    );
    const hasOfficeId = entityMetadata.columns.some(
      (c) => c.propertyName === 'office',
    );
    const hasDepartmentId = entityMetadata.columns.some(
      (c) => c.propertyName === 'department',
    );
    const hasTeamId = entityMetadata.columns.some(
      (c) => c.propertyName === 'team',
    );
    const hasCreatedBy = entityMetadata.columns.some(
      (c) => c.propertyName === 'createdBy',
    );
    const hasUpdatedBy = entityMetadata.columns.some(
      (c) => c.propertyName === 'updatedBy',
    );

    // GENERAL scope
    if (
      scopes.includes(ScopedAccessEnum.GENERAL) &&
      hasBusinessId &&
      hasOfficeId &&
      hasDepartmentId &&
      hasTeamId
    ) {
      newFilter.filters?.push({
        logicalOperator: LogicalOperator.OR,
        filters: [
          {
            property: 'businessId',
            operator: ConditionalOperator.IS_NULL,
          },
          {
            property: 'officeId',
            operator: ConditionalOperator.IS_NULL,
          },
          {
            property: 'departmentId',
            operator: ConditionalOperator.IS_NULL,
          },
          {
            property: 'teamId',
            operator: ConditionalOperator.IS_NULL,
          },
        ],
      } as ListFilter);
    }

    // PERSONAL filters (created/updated by the user).
    if (
      scopes.includes(ScopedAccessEnum.PERSONAL) &&
      (hasCreatedBy || hasUpdatedBy)
    ) {
      newFilter.filters?.push({
        logicalOperator: LogicalOperator.OR,
        filters: [
          {
            property: 'createdById',
            operator: ConditionalOperator.EQUAL,
            value: cu.sub.toString(),
          },
          {
            property: 'updatedById',
            operator: ConditionalOperator.EQUAL,
            value: cu.sub.toString(),
            logicalOperator: LogicalOperator.OR,
          },
        ],
      } as ListFilter);
    }

    // Hierarchical filters.
    // Create Hierarchical filtes
    const hierarchicalFilter: ListFilter = {
      logicalOperator: LogicalOperator.OR,
      filters: [],
    } as unknown as ListFilter;
    if (
      scopes.includes(ScopedAccessEnum.BUSINESS) &&
      hasBusinessId &&
      cu.businessId
    ) {
      hierarchicalFilter.filters?.push({
        property: 'businessId',
        operator: ConditionalOperator.EQUAL,
        value: cu.businessId?.toString(),
      });
    }
    if (
      scopes.includes(ScopedAccessEnum.OFFICE) &&
      hasOfficeId &&
      cu.officeId
    ) {
      hierarchicalFilter.filters?.push({
        property: 'officeId',
        operator: ConditionalOperator.EQUAL,
        value: cu.officeId.toString(),
      });
    }
    if (
      scopes.includes(ScopedAccessEnum.DEPARTMENT) &&
      hasDepartmentId &&
      cu.departmentId
    ) {
      hierarchicalFilter.filters?.push({
        property: 'departmentId',
        operator: ConditionalOperator.EQUAL,
        value: cu.departmentId.toString(),
      });
    }
    if (scopes.includes(ScopedAccessEnum.TEAM) && hasTeamId && cu.teamId) {
      hierarchicalFilter.filters?.push({
        property: 'teamId',
        operator: ConditionalOperator.EQUAL,
        value: cu.teamId.toString(),
      });
    }

    if (hierarchicalFilter.filters?.length || 0 > 0) {
      newFilter.filters?.push(hierarchicalFilter);
    }

    return newFilter;
  }

  private async forBaseFindRelatedFilters<T extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<T>,
    filters: ListFilter[],
  ): Promise<void> {
    // // 1. Obtener todas las entidades relacionadas con el usuario
    // const relations = await this.relationService.getRelatedEntitiesForUser(
    //   cu.sub,
    // );
    // if (!relations || relations.length === 0) return;
    // // 2. Agrupar por tipo de entidad
    // const entityGroups = relations.reduce(
    //   (acc, rel) => {
    //     if (!acc[rel.entityType]) {
    //       acc[rel.entityType] = [];
    //     }
    //     acc[rel.entityType].push(rel.entityId);
    //     return acc;
    //   },
    //   {} as Record<string, number[]>,
    // );
    // // 3. Para cada tipo de entidad, crear condición IN
    // for (const [entityType, ids] of Object.entries(entityGroups)) {
    //   if (repository.metadata.targetName === entityType && ids.length > 0) {
    //     filters.push({
    //       property: 'id',
    //       operator: ConditionalOperator.IN,
    //       value: ids.join(','),
    //       logicalOperator: LogicalOperator.OR,
    //     });
    //   }
    // }
  }

  /**
   * Validates and completes hierarchy fields in create DTO based on user role and scopes
   * @param cu Current user payload
   * @param createDto The DTO being validated
   * @param scopes Allowed scopes for the operation
   */
  public forBaseCreate(
    cu: JWTPayload,
    createDto: any,
    scopes?: ScopedAccessEnum[],
  ) {
    const effectiveScopes = scopes ?? Object.values(ScopedAccessEnum);

    if (cu) {
      createDto.createdBy = { id: cu.sub };
      createDto.updatedBy = { id: cu.sub };
    }

    // SUPER users must provide at least businessId
    if (cu.role?.some((r) => r === Role.SUPER)) {
      // if (
      //   !createDto.businessId &&
      //   effectiveScopes.includes(ScopedAccessEnum.BUSINESS)
      // ) {
      //   throw new BadRequestError('SUPER users must provide businessId');
      // }
      return this.transformIdsToRelations(createDto);
    }

    // PRINCIPAL users - set businessId and // require officeId
    if (cu.role?.some((r) => r === Role.PRINCIPAL)) {
      if (effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        createDto.businessId = cu.businessId;
      }

      // if (
      //   !createDto.officeId &&
      //   effectiveScopes.includes(ScopedAccessEnum.OFFICE)
      // ) {
      //   throw new BadRequestError('PRINCIPAL users must provide officeId');
      // }
      return this.transformIdsToRelations(createDto);
    }

    // ADMIN users - set businessId and officeId, require departmentId
    if (cu.role?.some((r) => r === Role.ADMIN)) {
      if (effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        createDto.businessId = cu.businessId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.OFFICE)) {
        createDto.officeId = cu.officeId;
      }

      if (
        !createDto.departmentId &&
        effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT)
      ) {
        throw new BadRequestError('ADMIN users must provide departmentId');
      }
      return this.transformIdsToRelations(createDto);
    }

    // MANAGER users - set businessId, officeId and departmentId, require teamId
    if (cu.role?.some((r) => r === Role.MANAGER)) {
      if (effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        createDto.businessId = cu.businessId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.OFFICE)) {
        createDto.officeId = cu.officeId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT)) {
        createDto.departmentId = cu.departmentId;
      }

      if (
        !createDto.teamId &&
        effectiveScopes.includes(ScopedAccessEnum.TEAM)
      ) {
        throw new BadRequestError('MANAGER users must provide teamId');
      }
      return this.transformIdsToRelations(createDto);
    }

    // SUPERVISOR and AGENT users - set all hierarchy fields
    if (cu.role?.some((r) => r === Role.SUPERVISOR || r === Role.AGENT)) {
      if (effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        createDto.businessId = cu.businessId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.OFFICE)) {
        createDto.officeId = cu.officeId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT)) {
        createDto.departmentId = cu.departmentId;
      }
      if (effectiveScopes.includes(ScopedAccessEnum.TEAM)) {
        createDto.teamId = cu.teamId;
      }
      return this.transformIdsToRelations(createDto);
    }

    // USER role (or no matching role) - no hierarchy access by default
    throw new UnauthorizedError('User role does not have create permissions');
  }

  /**
   * Transforms ID fields into relation objects (e.g., businessId -> business: { id })
   * @param createDto The DTO to transform
   */
  private transformIdsToRelations(createDto: any) {
    const transformedDto = { ...createDto };

    if (createDto.businessId !== undefined && createDto.businessId !== null) {
      transformedDto.business = { id: createDto.businessId } as Business;
      delete transformedDto.businessId;
    }

    if (createDto.officeId !== undefined && createDto.officeId !== null) {
      transformedDto.office = { id: createDto.officeId } as Office;
      delete transformedDto.officeId;
    }

    if (
      createDto.departmentId !== undefined &&
      createDto.departmentId !== null
    ) {
      transformedDto.department = { id: createDto.departmentId } as Department;
      delete transformedDto.departmentId;
    }

    if (createDto.teamId !== undefined && createDto.teamId !== null) {
      transformedDto.team = { id: createDto.teamId } as Team;
      delete transformedDto.teamId;
    }

    return transformedDto;
  }

  /**
   * Validates and transforms update DTO based on user role and scopes
   * @param cu Current user payload
   * @param updateDto The DTO being validated
   * @param scopes Allowed scopes for the operation
   */
  public forBaseUpdate(
    cu: JWTPayload,
    updateDto: any,
    scopes?: ScopedAccessEnum[],
  ) {
    const effectiveScopes = scopes ?? Object.values(ScopedAccessEnum);

    // Always update the updatedBy field
    updateDto.updatedBy = { id: cu.sub };

    // SUPER users can modify any hierarchy fields
    if (cu.role?.some((r) => r === Role.SUPER)) {
      return this.transformIdsToRelations(updateDto);
    }

    // Validate hierarchy field modifications based on role
    if (
      updateDto.businessId !== undefined ||
      updateDto.business !== undefined
    ) {
      if (!cu.role?.some((r) => r === Role.SUPER)) {
        throw new UnauthorizedError('Only SUPER users can modify business');
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        throw new UnauthorizedError(
          'Business scope not allowed for this operation',
        );
      }
    }

    if (updateDto.officeId !== undefined || updateDto.office !== undefined) {
      if (!cu.role?.some((r) => r === Role.SUPER || r === Role.PRINCIPAL)) {
        throw new UnauthorizedError(
          'Only SUPER and PRINCIPAL users can modify office',
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.OFFICE)) {
        throw new UnauthorizedError(
          'Office scope not allowed for this operation',
        );
      }
    }

    if (
      updateDto.departmentId !== undefined ||
      updateDto.department !== undefined
    ) {
      if (
        !cu.role?.some(
          (r) => r === Role.SUPER || r === Role.PRINCIPAL || r === Role.ADMIN,
        )
      ) {
        throw new UnauthorizedError(
          'Only SUPER, PRINCIPAL and ADMIN users can modify department',
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT)) {
        throw new UnauthorizedError(
          'Department scope not allowed for this operation',
        );
      }
    }

    if (updateDto.teamId !== undefined || updateDto.team !== undefined) {
      if (
        !cu.role?.some(
          (r) =>
            r === Role.SUPER ||
            r === Role.PRINCIPAL ||
            r === Role.ADMIN ||
            r === Role.MANAGER,
        )
      ) {
        throw new UnauthorizedError(
          'Only SUPER, PRINCIPAL, ADMIN and MANAGER users can modify team',
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.TEAM)) {
        throw new UnauthorizedError(
          'Team scope not allowed for this operation',
        );
      }
    }

    return this.transformIdsToRelations(updateDto);
  }
}
