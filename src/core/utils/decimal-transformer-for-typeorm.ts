import { ValueTransformer } from 'typeorm';

export class DecimalTransformer implements ValueTransformer {
  /**
   * Transforma el valor al guardarlo en la base de datos
   */
  to(data: number): number {
    return data;
  }

  /**
   * Transforma el valor al leerlo de la base de datos
   */
  from(data: string): number {
    return parseFloat(data);
  }
}
