export interface ListSummary {
  /**
   * List of elements that make up the store
   */
  data: unknown;

  /**
   * Total items without taking into account pagination
   */
  totalCount: number;
}
