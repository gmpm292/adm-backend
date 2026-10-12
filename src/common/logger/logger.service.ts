/* eslint-disable @typescript-eslint/require-await */
import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';

import { Log } from './log/entities/log.entity';

const { combine, timestamp, simple } = format;

/**
 * Logger de la aplicación: winston a consola (en Heroku, stdout queda en sus
 * registros). Nivel `info`: `debug` y `verbose` no se escriben.
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private logger: Logger;

  public constructor() {
    this.logger = createLogger({
      transports: [
        new transports.Console({
          format: combine(timestamp(), simple()),
        }),
      ],
    });
  }

  /**
   * Escribe en consola con nivel info.
   *
   * @param message Resumen del mensaje
   * @param meta Información adicional (contexto)
   */
  public log(message: string, meta: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Write fatal logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public fatal(message: string, meta: any): void {
    // Los niveles de winston (npm) no tienen `crit`.
    this.logger.error(message, meta);
  }

  /**
   * Write verbose logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public verbose(message: string, meta: any): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Write debug logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public debug(message: string, meta: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Write error logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async error(message: string, meta: Record<string, unknown>) {
    this.logger.error(message, meta);
  }

  /**
   * Write info logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async info(message: string, meta: Record<string, unknown>) {
    this.logger.info(message, meta);
  }

  /**
   * Write warning logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async warn(message: string, meta: Record<string, unknown>) {
    this.logger.warn(message, meta);
  }

  /**
   * Escribe en consola el detalle de un error 500 (pila incluida): al cliente
   * solo le llega el `intServErrorId` de `meta`, que sirve para buscarlo.
   */
  public saveInternalServerError(
    message: string,
    meta: Record<string, unknown>,
  ): Log {
    const log: Log = {
      createdAt: new Date(),
      level: 'internalServerError',
      message,
      meta,
    };
    this.logger.error(`Internal Server Error: ${message}`, meta);
    return log;
  }
}
