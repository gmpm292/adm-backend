import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ChangePolicyStatusError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ChangePolicyStatusError';
    super({ code: AppErrorCode.ChangePolicyStatusError, message });
  }
}
