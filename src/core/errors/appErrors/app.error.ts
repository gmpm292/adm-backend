import { AppErrorInput } from '../interfaces/appError.input';

export class AppError extends Error {
  constructor(appErrorInput: AppErrorInput) {
    super(JSON.stringify(appErrorInput));
  }
}
