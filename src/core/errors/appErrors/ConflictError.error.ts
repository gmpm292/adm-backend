import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ConflictError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'ConflictError';
    super({ code: AppErrorCode.ConflictError, message });
  }
}
