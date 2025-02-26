import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ConfirmationTokenUserError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ConfirmationTokenUserError';
    super({ code: AppErrorCode.ConfirmationTokenUserError, message });
  }
}
