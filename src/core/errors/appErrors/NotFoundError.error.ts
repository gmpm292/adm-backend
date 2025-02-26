import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class NotFoundError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'NotFoundError';
    super({ code: AppErrorCode.NotFoundError, message });
  }
}
