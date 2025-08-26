export class PriceRangeCondition {
  min: number;
  max: number | null; // null = sin límite superior
  currency: string;
  amount: number;
}
