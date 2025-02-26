import { AppError } from './app.error';
import { AppErrorCode } from '../AppErrorCode.enum';

export class ChangeCustomerQuotationStatusError extends AppError {
  constructor(messageInput?: string) {
    const message: string = messageInput
      ? messageInput
      : 'ChangeCustomerQuotationStatusError';
    super({ code: AppErrorCode.ChangeLeadCenterStatusError, message });
  }
}
