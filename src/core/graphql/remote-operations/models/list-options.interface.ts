import {
  IsBoolean,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ListFilter } from './list-filter.interface';
import { ListSort } from './list-sort.interface';
import { Type } from 'class-transformer';

/**
 * Options used to paging, filtering and sort.
 */
export class ListOptions {
  /**
   * Position where start the page (paging purpose)
   */
  @IsOptional()
  @IsNumber()
  skip?: number;

  /**
   * Size of page (paging purpose)
   */
  @IsOptional()
  @IsNumber()
  take?: number;

  /**
   * Includes deleted items
   */
  @IsOptional()
  @IsBoolean()
  withDeleted?: boolean;

  /**
   * List of filters to apply. @see ListFilter
   */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ListFilter)
  filters?: ListFilter[];

  /**
   * List of criteria by which to sort. @see ListSort
   */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ListSort)
  sorts?: ListSort[];

  /**
   * A list of strings representing all the fields requested in the GraphQL query.
   * This field is populated when passing through the @Opts() decorator, which handles and extracts the arguments from the request.
   */
  requestedFields?: string[];

  /**
   * An object representing all the fields requested in the GraphQL query, with all nested fields.
   * This field is populated when passing through the @Opts() decorator, which handles and extracts the arguments from the request.
   */
  requestedFieldsMap?: Record<string, any>;
}
