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
import { ResourceScopedAccessService } from './resource-scoped-access.service';

/**
 * Traduce el alcance (empresa, oficina, departamento, equipo, propio...) a
 * filtros y datos para el `BaseService`. El alcance sale, por este orden, del
 * que pasa el servicio, del nivel de acceso de la empresa para la operación
 * o, por defecto, de todos menos GENERAL y PERSONAL. SUPER no se filtra.
 */
@Injectable()
export class ScopedAccessService {
  // Variable para controlar el nivel de detalle en errores
  private readonly showErrorDetails: boolean;

  constructor(
    private readonly resourceScopedAccessService: ResourceScopedAccessService,
  ) {
    // Determinar si mostrar detalles según NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    this.showErrorDetails = nodeEnv !== 'production';
  }

  // Método privado para construir mensajes de error con o sin detalles
  private buildErrorMessage(baseMessage: string, details: string = ''): string {
    return this.showErrorDetails ? `${baseMessage}${details}` : baseMessage;
  }

  /**
   * Alcance a usar cuando el servicio tiene uno propio por defecto: si la
   * empresa configuró el suyo para la operación en curso, manda ese
   * (`undefined` deja que lo resuelvan los métodos `forBase*`).
   */
  public scopesOrDefault(
    cu: JWTPayload | undefined,
    fallback: ScopedAccessEnum[],
  ): ScopedAccessEnum[] | undefined {
    if (!cu) return fallback;
    const configured =
      this.resourceScopedAccessService.findByBusinessAndQueryOrEndpoint(
        cu.businessId as number,
        cu.currentQueryOrEndpoint as string,
      )?.accessLevels;
    return configured ? undefined : fallback;
  }

  /**
   * Condiciones `where` de TypeORM para buscar un registro: cada elemento del
   * array es una alternativa (OR). Solo filtra por las columnas que tenga la
   * entidad y los datos que lleve el token.
   */
  public forBaseFindOne<Entity extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<Entity>,
    scopes?: ScopedAccessEnum[],
  ): FindOptionsWhere<Entity>[] {
    const filters: FindOptionsWhere<Entity>[] = [];
    const dbScopes: ScopedAccessEnum[] | undefined =
      this.resourceScopedAccessService.findByBusinessAndQueryOrEndpoint(
        cu.businessId as number,
        cu.currentQueryOrEndpoint as string,
      )?.accessLevels;

    const effectiveScopes =
      scopes ||
      dbScopes ||
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // Obtener nombre de la entidad para mensajes de error
    const entityName = repository.metadata.name;

    // SUPER no tiene filtros (GENERAL no quita filtros: añade los registros
    // sin empresa, oficina, departamento ni equipo).
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

    // Un `{}` no restringe nada: solo cuenta si lleva algún nivel.
    if (Object.keys(hierarchicalFilter).length > 0) {
      filters.push(hierarchicalFilter);
    }

    // If no filters and user isn't SUPER, deny access
    if (filters.length === 0) {
      const details = this.showErrorDetails ? ` on entity '${entityName}'` : '';
      throw new UnauthorizedError(
        this.buildErrorMessage(
          'Access denied: No valid scope filters could be applied',
          details,
        ),
      );
    }

    return filters;
  }

  /**
   * Filtros de listado (`ListFilter`) según el alcance efectivo. SUPER no
   * tiene filtros; si no se puede aplicar ninguno, lanza 401.
   */
  public forBaseFind<T extends ObjectLiteral>(
    cu: JWTPayload,
    repository: Repository<T>,
    scopes?: ScopedAccessEnum[],
  ): ListFilter[] {
    const filters: Array<ListFilter> = [];
    const dbScopes: ScopedAccessEnum[] | undefined =
      this.resourceScopedAccessService.findByBusinessAndQueryOrEndpoint(
        cu.businessId as number,
        cu.currentQueryOrEndpoint as string,
      )?.accessLevels;

    const effectiveScopes =
      scopes ||
      dbScopes ||
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // Obtener nombre de la entidad para el mensaje de error
    const entityName = repository.metadata.name;

    // SUPER no tiene filtros (GENERAL no los quita: añade un filtro más).
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

    // RELATED no está implementado: no añade filtros, así que con solo ese
    // nivel se deniega el acceso.

    // If no applicable filters and user is not SUPER, deny access.
    if (filters.length === 0 && !cu.role.some((r) => r === Role.SUPER)) {
      const details = this.showErrorDetails ? ` on entity '${entityName}'` : '';
      throw new UnauthorizedError(
        this.buildErrorMessage(
          'Access denied: You do not have permissions for this operation',
          details,
        ),
      );
    }

    return filters;
  }

  /**
   * Grupos de filtros unidos con OR: GENERAL (sin empresa, oficina,
   * departamento ni equipo), PERSONAL (creado o modificado por el usuario) y
   * el jerárquico (cada nivel del alcance igual al del token, todos con AND).
   */
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

  /**
   * Completa el DTO de creación: `createdBy`/`updatedBy` y, según el rol, los
   * niveles de la empresa tomados del token (los que el alcance incluya).
   * SUPER los indica a mano. ADMIN debe indicar el departamento y MANAGER el
   * equipo (si el alcance los incluye); USER, o sin rol de empresa, no puede
   * crear. Devuelve los `*Id` convertidos en relaciones.
   */
  public forBaseCreate(
    cu: JWTPayload,
    createDto: any,
    scopes?: ScopedAccessEnum[],
  ) {
    const dbScopes: ScopedAccessEnum[] | undefined =
      this.resourceScopedAccessService.findByBusinessAndQueryOrEndpoint(
        cu.businessId as number,
        cu.currentQueryOrEndpoint as string,
      )?.accessLevels;

    const effectiveScopes =
      scopes ||
      dbScopes ||
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // Obtener información del usuario para mensajes de error
    const userId = cu.sub;
    const userRoles = cu.role?.join(', ') || 'no roles';

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
      //   const details = this.showErrorDetails ? ` (User: ${userId}, Roles: ${userRoles})` : '';
      //   throw new BadRequestError(
      //     this.buildErrorMessage('SUPER users must provide businessId', details)
      //   );
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
      //   const details = this.showErrorDetails ? ` (User: ${userId}, Roles: ${userRoles})` : '';
      //   throw new BadRequestError(
      //     this.buildErrorMessage('PRINCIPAL users must provide officeId', details)
      //   );
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
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new BadRequestError(
          this.buildErrorMessage(
            'ADMIN users must provide departmentId',
            details,
          ),
        );
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
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new BadRequestError(
          this.buildErrorMessage('MANAGER users must provide teamId', details),
        );
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
    const details = this.showErrorDetails
      ? ` (User: ${userId}, Roles: ${userRoles})`
      : '';
    throw new UnauthorizedError(
      this.buildErrorMessage(
        'User role does not have create permissions',
        details,
      ),
    );
  }

  /**
   * Cambia `businessId`, `officeId`, `departmentId` y `teamId` por relaciones
   * (`business: { id }`...). Devuelve una copia.
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
   * Pone `updatedBy` y comprueba quién cambia de lugar un registro: empresa
   * solo SUPER; oficina SUPER y PRINCIPAL; departamento además ADMIN; equipo
   * además MANAGER. El alcance debe incluir ese nivel. Lanza 401 si no.
   */
  public forBaseUpdate(
    cu: JWTPayload,
    updateDto: any,
    scopes?: ScopedAccessEnum[],
  ) {
    const dbScopes: ScopedAccessEnum[] | undefined =
      this.resourceScopedAccessService.findByBusinessAndQueryOrEndpoint(
        cu.businessId as number,
        cu.currentQueryOrEndpoint as string,
      )?.accessLevels;

    const effectiveScopes =
      scopes ||
      dbScopes ||
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.GENERAL && e != ScopedAccessEnum.PERSONAL,
      );

    // Obtener información del usuario para mensajes de error
    const userId = cu.sub;
    const userRoles = cu.role?.join(', ') || 'no roles';

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
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Only SUPER users can modify business',
            details,
          ),
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.BUSINESS)) {
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Business scope not allowed for this operation',
            details,
          ),
        );
      }
    }

    if (updateDto.officeId !== undefined || updateDto.office !== undefined) {
      if (!cu.role?.some((r) => r === Role.SUPER || r === Role.PRINCIPAL)) {
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Only SUPER and PRINCIPAL users can modify office',
            details,
          ),
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.OFFICE)) {
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Office scope not allowed for this operation',
            details,
          ),
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
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Only SUPER, PRINCIPAL and ADMIN users can modify department',
            details,
          ),
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.DEPARTMENT)) {
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Department scope not allowed for this operation',
            details,
          ),
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
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Only SUPER, PRINCIPAL, ADMIN and MANAGER users can modify team',
            details,
          ),
        );
      }
      if (!effectiveScopes.includes(ScopedAccessEnum.TEAM)) {
        const details = this.showErrorDetails
          ? ` (User: ${userId}, Roles: ${userRoles})`
          : '';
        throw new UnauthorizedError(
          this.buildErrorMessage(
            'Team scope not allowed for this operation',
            details,
          ),
        );
      }
    }

    return this.transformIdsToRelations(updateDto);
  }
}
