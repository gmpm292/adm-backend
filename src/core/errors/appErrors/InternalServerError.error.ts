import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class InternalServerError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'InternalServerError';
    super({ code: AppErrorCode.InternalServerError, message });
  }
}
