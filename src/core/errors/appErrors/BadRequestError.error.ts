import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class BadRequestError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'BadRequestError';
    super({ code: AppErrorCode.BadRequestError, message });
  }
}
