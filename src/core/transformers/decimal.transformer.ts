import { ValueTransformer } from 'typeorm';

/**
 * Postgres devuelve las columnas `decimal` como texto; sin esto
 * `acumulado + importe` concatena ("10.00" + 5 = "10.005").
 */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
