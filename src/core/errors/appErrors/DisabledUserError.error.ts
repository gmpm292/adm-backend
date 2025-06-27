import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class DisabledUserError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput ? messageInput : 'DisabledUserError';
    super({ code: AppErrorCode.DisabledUserError, message });
  }
}
