export class TelegramStatsOutput {
  total: number; // Total de mensajes
  sent: number; // Mensajes enviados
  delivered: number; // Mensajes entregados
  failed: number; // Mensajes fallidos
  pending: number; // Mensajes pendientes
  successRate: number; // Tasa de éxito (0-1)
  byBotToken: Record<
    string,
    {
      // Estadísticas por bot
      sent: number;
      failed: number;
    }
  >;
  byMessageType: Record<
    string,
    {
      // Estadísticas por tipo
      sent: number;
      failed: number;
    }
  >;
}
