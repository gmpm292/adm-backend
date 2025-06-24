export interface TelegramError {
  message: string;
  stack?: string;
  code?: string;
  timestamp: Date;
}
