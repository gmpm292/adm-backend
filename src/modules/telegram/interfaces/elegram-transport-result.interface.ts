export interface TelegramTransportResult {
  success: boolean;
  messageId?: number;
  chatId?: string;
  userId?: string; // Para mensajes por teléfono
  timestamp?: Date;
  error?: {
    code: string;
    message: string;
  };
}
