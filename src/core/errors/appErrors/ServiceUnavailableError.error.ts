import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ServiceUnavailableError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ServiceUnavailableError';
    super({ code: AppErrorCode.ServiceUnavailableError, message });
  }
}
