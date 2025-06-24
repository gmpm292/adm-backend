import { TelegramMessageType } from '../enums/telegram-message-type.enum';

export interface TelegramSendOptions {
  chatId?: string; // ID de chat de Telegram (opcional si se usa phoneNumber)
  phoneNumber?: string; // Número de teléfono en formato internacional (ej: +521234567890)
  message: string; // Contenido del mensaje
  messageType: TelegramMessageType; // Tipo de mensaje (text, markdown, html, etc.)
  attachments?: Array<{
    // Adjuntos (opcional)
    type: string; // Tipo de archivo (photo, document, etc.)
    url: string; // URL o path del archivo
    caption?: string; // Descripción (opcional)
  }>;
  botTokenKey?: string; // Clave del bot a usar (default: 'default')
  parseMode?: string; // Modo de parseo (HTML, MarkdownV2) - se infiere de messageType
  context?: Record<string, any>; // Contexto para templates (opcional)
}
