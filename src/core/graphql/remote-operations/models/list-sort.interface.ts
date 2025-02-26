import { IsEnum, IsString } from 'class-validator';
import { SortDirection } from '../enums/sort-direction.enum';

export class ListSort {
  /**
   * Entity's field who is the target in the sort
   */
  @IsString()
  property: string;

  /**
   * Sort direction (ascending or descending)
   * It is possible to use custom as follows:
   * options.sort = 'agreement.status'
   * property: `(case when ${options.sort} is "red" then 1 when ${options.sort} is "yellow" then 2 when ${options.sort} is "green" then 3 else null end)`
   */
  @IsEnum(SortDirection)
  direction: SortDirection;
}
