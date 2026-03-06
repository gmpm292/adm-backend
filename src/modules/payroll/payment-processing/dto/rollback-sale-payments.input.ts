import { IsInt, IsBoolean, IsString, Min, IsOptional } from 'class-validator';

export class RollbackSalePaymentsInput {
  @IsInt()
  @Min(1)
  saleId: number;

  @IsString()
  reason: string; // "Devolución de producto", "Venta cancelada", etc.

  @IsBoolean()
  compensateInNextPeriod: boolean = true; // Crear descuentos para próximo período

  @IsOptional()
  @IsInt()
  @Min(1)
  nextPeriodId?: number; // Período específico para compensación
}
