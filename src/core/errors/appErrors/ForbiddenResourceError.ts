import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ForbiddenResourceError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ForbiddenResourceError';
    super({ code: AppErrorCode.ForbiddenResourceError, message });
  }
}
