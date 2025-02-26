import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class UnauthorizedError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'UnauthorizedError';
    super({ code: AppErrorCode.UnauthorizedError, message });
  }
}
