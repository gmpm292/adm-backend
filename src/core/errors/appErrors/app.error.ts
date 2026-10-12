import { AppErrorInput } from '../interfaces/appError.input';

/**
 * Base de los errores de negocio. Guarda `{ code, message }` como JSON en el
 * mensaje; `formatError` lo desempaqueta para el cliente.
 */
export class AppError extends Error {
  constructor(appErrorInput: AppErrorInput) {
    super(JSON.stringify(appErrorInput));
  }
}
