import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ChangeLeadCenterStatusError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ChangeLeadCenterStatusError';
    super({ code: AppErrorCode.ChangeLeadCenterStatusError, message });
  }
}
