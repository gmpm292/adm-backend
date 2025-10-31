/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Brackets,
  Repository,
  WhereExpressionBuilder,
  ObjectLiteral,
} from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';

import { ConditionalOperator } from '../enums/conditional-operation.enum';
import { ListFilter } from '../models/list-filter.interface';
import { ListOptions } from '../models/list-options.interface';
import { ListSort } from '../models/list-sort.interface';
import { LogicalOperator } from '../enums/logical-operator.enum';
import { SortDirection } from '../enums/sort-direction.enum';
import { isDate, isISO8601 } from 'class-validator';
import * as moment from 'moment';
import { SelectField } from '../types/select-field.type';
import { MapperOptions } from '../types/mapper-options.type';

export class ListOptionsTypeOrmQueryBuilderMapper {
  /**
   * Translate an object "instance of" ListOptions into another "instance of" QueryBuilder
   *
   * @param filters @see ListOptions
   * @param skip @see ListOptions
   * @param sorts @see ListOptions
   * @param take @see ListOptions
   * @param repository
   * @param relationsToLoad @example ['nameTable1', 'nameTable2']
   */

  /**
   * Translate an object "instance of" ListOptions into another "instance of" QueryBuilder
   *
   * @param filters @see ListOptions
   * @param skip @see ListOptions
   * @param sorts @see ListOptions
   * @param take @see ListOptions
   * @param repository
   * @param relationsToLoad
   */
  public mapToQueryBuilder<Entity extends ObjectLiteral>(
    {
      filters,
      skip,
      sorts,
      take,
      withDeleted = false,
      requestedFields,
      requestedFieldsMap,
    }: ListOptions,
    repository: Repository<Entity>,
    relationsToLoad?: Array<keyof Entity | string>,
    {
      selectFields,
      filterRelations = false,
      autoSelectFields = false,
    }: MapperOptions = {},
  ): SelectQueryBuilder<Entity> {
    const queryBuilder = repository
      .createQueryBuilder('root')
      .skip(skip)
      .take(take);

    if (withDeleted) {
      queryBuilder.withDeleted();
    }

    if (sorts) {
      this.addOrderToQueryBuilder<Entity>(sorts, queryBuilder);
    }

    if (filters) {
      this.convertDatesToLocalTime(filters);
      this.addFiltersToQueryBuilder<Entity>(filters, queryBuilder);
    }

    if (filterRelations && requestedFields && requestedFieldsMap) {
      relationsToLoad = this.filterNecessaryRelations({
        relationsToLoad,
        filters,
        sorts,
        requestedFields,
        requestedFieldsMap,
      });
    }
    if (relationsToLoad && relationsToLoad.length > 0) {
      this.addRelations<Entity>(relationsToLoad, queryBuilder);
    }

    if (autoSelectFields && requestedFields && requestedFieldsMap) {
      selectFields = this.autoSelectFields(
        selectFields as SelectField[],
        relationsToLoad as Array<string>,
        requestedFields,
        requestedFieldsMap,
      );
    }

    if (selectFields && selectFields?.length > 0) {
      this.addSelections<Entity>(selectFields, queryBuilder);
    }

    return queryBuilder;
  }

  protected convertDatesToLocalTime(filters: ListFilter[]) {
    filters.map((filter) => {
      const beginWithDate = (val) => {
        const regex =
          /^(\d{4}-\d{2}-\d{2})|(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)?\d{2}/;
        return regex.test(val);
      };
      const value = filter.value;
      if (
        typeof value == 'string' &&
        value?.endsWith('z') &&
        (isISO8601(value) || isDate(value) || beginWithDate(value))
      ) {
        const date = new Date(value);
        return (filter.value = String(
          moment(date).format('YYYY/MM/DD HH:mm:ss'),
        ));
      }
      return filter;
    });
  }

  protected addFiltersToQueryBuilder<Entity extends ObjectLiteral>(
    filters: ListFilter[],
    queryBuilder: SelectQueryBuilder<Entity>,
  ): void {
    const principals = filters.filter((f) => f.principal);
    const noPrincipals = filters.filter((f) => !f.principal);
    if (principals.length > 0) {
      this.addFilters(principals, queryBuilder);
      if (noPrincipals.length > 0) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            this.addFilters(noPrincipals, qb);
          }),
        );
      }
    } else {
      this.addFilters(noPrincipals, queryBuilder);
    }
  }

  protected addFilters<Entity extends ObjectLiteral>(
    filters: ListFilter[],
    queryBuilder: SelectQueryBuilder<Entity> | WhereExpressionBuilder,
  ): void {
    filters.forEach(
      ({ value, operator, property, logicalOperator, filters }: ListFilter) => {
        if (
          (value && operator && property) ||
          ((operator == ConditionalOperator.IS_NULL ||
            operator == ConditionalOperator.IS_NOT_NULL) &&
            property)
        ) {
          const [where, parameters] = this.buildWhereClauseAndParameters({
            value,
            operator,
            property,
          });

          if (!logicalOperator || logicalOperator === LogicalOperator.AND) {
            if (parameters) {
              queryBuilder.andWhere(
                new Brackets((qb) => qb.where(where, parameters)),
              );
            } else {
              queryBuilder.andWhere(new Brackets((qb) => qb.where(where)));
            }
          } else {
            queryBuilder.orWhere(
              new Brackets((qb) => qb.where(where, parameters ?? {})),
            );
          }
        }

        if (filters) {
          if (!logicalOperator || logicalOperator === LogicalOperator.AND) {
            queryBuilder.andWhere(
              new Brackets((qb) => {
                this.addFilters(filters, qb);
              }),
            );
          } else {
            queryBuilder.orWhere(
              new Brackets((qb) => {
                this.addFilters(filters, qb);
              }),
            );
          }
        }
      },
    );
  }

  protected addOrderToQueryBuilder<Entity extends ObjectLiteral>(
    sorts: ListSort[],
    queryBuilder: SelectQueryBuilder<Entity>,
  ): void {
    sorts.forEach(({ property, direction }: ListSort) => {
      // if the property is a relation (has a dot '.') then keep the name, if not add
      // the root alias
      if (direction === SortDirection.CUSTOM) {
        queryBuilder.addOrderBy(property);
      } else {
        const sortProperty = property.includes('.')
          ? property
          : `root.${property}`;
        queryBuilder.addOrderBy(sortProperty, direction);
      }
    });
  }

  protected addRelations<Entity extends ObjectLiteral>(
    relationsToLoad: Array<keyof Entity | string>,
    queryBuilder: SelectQueryBuilder<Entity>,
  ): void {
    relationsToLoad.forEach((relation: keyof Entity | string) => {
      const { parameterName, propertyWithAlias } =
        this.createPropertyOfRelation(String(relation));
      queryBuilder.leftJoinAndSelect(propertyWithAlias, parameterName);
    });
  }

  protected addSelections<Entity extends ObjectLiteral>(
    selectFields: SelectField[],
    queryBuilder: SelectQueryBuilder<Entity>,
  ) {
    selectFields.forEach(({ field, alias }) => {
      alias
        ? queryBuilder.addSelect(field, alias)
        : queryBuilder.addSelect(field);
    });
    return queryBuilder;
  }

  protected buildWhereClauseAndParameters({
    value,
    operator,
    property,
  }: ListFilter): [string, Record<string, unknown> | null] {
    // it needs to provide unique parameters in your WHERE expressions and
    // should have to alias
    const { parameterName, propertyWithAlias } =
      this.createPropertyWithAliasAndParameterName(property || '');

    switch (operator) {
      case ConditionalOperator.ANY:
        return [
          `${propertyWithAlias} = ${value}`,
          {} as Record<string, unknown>,
        ];
      case ConditionalOperator.ANY_OPERATOR_AND_VALUE:
        return [`${propertyWithAlias} ${value}`, {} as Record<string, unknown>];
      case ConditionalOperator.EQUAL:
        return [
          `${propertyWithAlias} = :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.DISTINCT:
        return [
          `${propertyWithAlias} != :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.GREATER_THAN:
        return [
          `${propertyWithAlias} > :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.GREATER_EQUAL_THAN:
        return [
          `${propertyWithAlias} >= :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.LESS_THAN:
        return [
          `${propertyWithAlias} < :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.LESS_EQUAL_THAN:
        return [
          `${propertyWithAlias} <= :${parameterName}`,
          { [parameterName]: value },
        ];
      case ConditionalOperator.START_WITH:
        return [
          `LOWER(${propertyWithAlias}) LIKE :${parameterName}`,
          { [parameterName]: `${value?.toLowerCase()}%` },
        ];
      case ConditionalOperator.END_WITH:
        return [
          `LOWER(${propertyWithAlias}) LIKE :${parameterName}`,
          { [parameterName]: `%${value?.toLowerCase()}` },
        ];
      case ConditionalOperator.CONTAINS:
        return [
          `LOWER(${propertyWithAlias}) LIKE :${parameterName}`,
          { [parameterName]: `%${value?.toLowerCase()}%` },
        ];
      case ConditionalOperator.NOT_CONTAINS:
        return [
          `LOWER(${propertyWithAlias}) NOT LIKE :${parameterName}`,
          { [parameterName]: `%${value?.toLowerCase()}%` },
        ];
      case ConditionalOperator.IS_NULL:
        return [`${propertyWithAlias} IS NULL`, {} as Record<string, unknown>];
      case ConditionalOperator.IS_NOT_NULL:
        return [
          `${propertyWithAlias} IS NOT NULL`,
          {} as Record<string, unknown>,
        ];

      default:
        throw new Error(`Operator ${operator} not allowed`);
    }
  }

  private propertyIndex = 0;
  protected createPropertyWithAliasAndParameterName(property: string): {
    parameterName: string;
    propertyWithAlias: string;
  } {
    this.propertyIndex++;
    if (property.includes('.')) {
      return {
        parameterName: `${property.split('.').pop()}${this.propertyIndex}`,
        propertyWithAlias: property,
      };
    }

    return {
      parameterName: `${property}${this.propertyIndex}`,
      propertyWithAlias: `root.${property}`,
    };
  }

  private createPropertyOfRelation(property: string): {
    parameterName: string;
    propertyWithAlias: string;
  } {
    if (property.includes('.')) {
      return {
        parameterName: `${property?.split('.').pop()?.split(' as ').pop()}`,
        propertyWithAlias: property?.split(' as ').shift() as string,
      };
    }

    return {
      parameterName: String(property),
      propertyWithAlias: `root.${property.split(' as ').shift()}`,
    };
  }

  private filterNecessaryRelations<Entity>({
    relationsToLoad,
    filters,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sorts,
    requestedFields,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    requestedFieldsMap,
  }: {
    relationsToLoad?: Array<keyof Entity | string>;
    filters?: ListFilter[];
    sorts?: ListSort[];
    requestedFields: string[];
    requestedFieldsMap: Record<string, any>;
  }): Array<string> {
    const relations = new Set<string>();

    if (relationsToLoad) {
      const extractFiltersProperties = (filters: ListFilter[]): string[] => {
        return (
          filters?.flatMap((filter) => {
            const properties: string[] = [];
            if (filter.property?.includes('.')) {
              const firstPart = filter.property.split('.')[0];
              if (firstPart) properties.push(firstPart);
            }
            if (filter.filters?.length) {
              properties.push(...extractFiltersProperties(filter.filters));
            }
            return properties;
          }) ?? []
        );
      };

      let fields = requestedFields.map((field) => {
        const parts = field.split('.');
        return parts.slice(2, -1).join('.');
      });

      if (filters) {
        fields = [...fields, ...extractFiltersProperties(filters)];
      }
      fields = [...new Set(fields.filter((f): f is string => Boolean(f)))];

      const loadPreviousRelations = (relation, relationsToLoad, relations) => {
        const firstPartRelation = relation.split('.').at(0);
        const newRelt = relationsToLoad.find(
          (relt: string) =>
            relt == firstPartRelation ||
            relt.endsWith(`.${firstPartRelation}`) ||
            relt.endsWith(` ${firstPartRelation}`),
        );
        if (newRelt && !relations.has(newRelt)) {
          relations.add(newRelt);
          loadPreviousRelations(newRelt, relationsToLoad, relations);
        }
      };

      relationsToLoad.forEach((relation) => {
        const relationAsField = relation as string;
        const { parameterName, propertyWithAlias } =
          this.createPropertyOfRelation(String(relationAsField));
        if (
          fields.includes(relationAsField) ||
          fields.includes(parameterName)
        ) {
          relations.add(relationAsField);
          loadPreviousRelations(propertyWithAlias, relationsToLoad, relations);
        }
      });
    }
    return Array.from(relations);
  }

  protected autoSelectFields(
    selectFields: SelectField[],
    relationsToLoad: Array<string>,
    requestedFields: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    requestedFieldsMap: Record<string, any>,
  ): SelectField[] {
    const removeIfNotHaveRelation = (
      field: string,
      relationsToLoad: Array<string>,
    ): string | null => {
      if (!field) return null;
      if (!field.includes('.')) return 'root.' + field;

      const firstPartField = field.split('.')[0];
      return relationsToLoad.some(
        (relt) =>
          relt === firstPartField ||
          relt.endsWith(`.${firstPartField}`) ||
          relt.endsWith(` ${firstPartField}`),
      )
        ? field
        : null;
    };

    const validFields = requestedFields
      .map((f) => {
        const field = f.split('.').slice(2).slice(-2).join('.');
        const validField = removeIfNotHaveRelation(field, relationsToLoad);
        return validField && !validField.includes('__')
          ? { field: validField }
          : null;
      })
      .filter((f): f is SelectField => f !== null);

    return [...(selectFields || []), ...validFields];
  }
}
