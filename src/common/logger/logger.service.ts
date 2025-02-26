/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';

//import { LogPostgresService } from './log/services/log-postgres.service';
import { Log } from './log/entities/log.entity';

const { combine, timestamp, simple } = format;

@Injectable()
export class AppLoggerService implements LoggerService {
  //future environment variable. write in console.
  private con = false;
  private logger: Logger;

  private internalServerErrors: Array<Log> = [];

  public constructor(/*private logService: LogPostgresService*/) {
    this.logger = createLogger({
      transports: [
        new transports.Console({
          format: combine(timestamp(), simple()),
        }),
      ],
    });
  }

  /**
   * Write logs
   *
   * @param level Level message log
   * @param message Summary message
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
    this.con
      ? this.logger.crit(message, meta)
      : this.saveInDB('critical', message, meta);
  }

  /**
   * Write verbose logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public verbose(message: string, meta: any): void {
    this.con
      ? this.logger.verbose(message, meta)
      : this.saveInDB('verbose', message, meta);
  }

  /**
   * Write debug logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public debug(message: string, meta: Record<string, unknown>): void {
    this.con
      ? this.logger.debug(message, meta)
      : this.saveInDB('debug', message, meta);
  }

  /**
   * Write error logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async error(message: string, meta: Record<string, unknown>) {
    // console.log('En error ');
    this.con
      ? this.logger.error(message, meta)
      : await this.saveInDB('error', message, meta);
  }

  /**
   * Write info logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async info(message: string, meta: Record<string, unknown>) {
    this.con
      ? this.logger.info(message, meta)
      : await this.saveInDB('info', message, meta);
  }

  /**
   * Write warning logs
   *
   * @param message Summary message
   * @param meta Extra log information (context)
   */
  public async warn(message: string, meta: Record<string, unknown>) {
    this.con
      ? this.logger.warn(message, meta)
      : await this.saveInDB('warning', message, meta);
  }

  public async internalServerError(
    message: string,
    meta: Record<string, unknown>,
    intServErrorId: string,
  ): Promise<Log> {
    if (this.con) {
      this.logger.error(message, meta);
      //TODO: este return no estaba pero sin el da error .
      return {
        level: 'internalServerError',
        message,
        meta,
      };
    } else {
      const error = this.findInternalServerError(intServErrorId);
      return this.saveInDB('internalServerError', message, {
        ...meta,
        error,
        intServErrorId,
      });
    }
  }

  public saveInternalServerError(
    message: string,
    meta: Record<string, unknown>,
  ): Log {
    const createdAt = new Date();
    const log: Log = {
      createdAt,
      level: 'internalServerError',
      message,
      meta,
    };
    this.internalServerErrors.push(log);
    // Delete expiration logs
    const expirationTimeInMinutes = 5;
    const now = new Date();
    const expirationTime = expirationTimeInMinutes * 60 * 1000;
    this.internalServerErrors = this.internalServerErrors.filter(
      (e) => now.getTime() - (e.createdAt?.getTime() ?? 0) < expirationTime,
    );

    return log;
  }

  public findInternalServerError(intServErrorId: string): Log | undefined {
    const index = this.internalServerErrors.findIndex(
      (e) => e.meta.intServErrorId === intServErrorId,
    );
    if (index !== -1) {
      const [removedElement] = this.internalServerErrors.splice(index, 1);
      return removedElement;
    }
    return undefined;
  }

  private async saveInDB(
    level: string,
    message: string,
    meta: Record<string, unknown>,
  ): Promise<Log> {
    const createdAt = new Date();
    const log: Log = {
      level,
      createdAt,
      message,
      meta,
    };
    if (meta?.intServErrorId)
      log.intServErrorId = meta.intServErrorId as string;
    if (meta?.user) log.userId = (meta as any).user?.sub;

    try {
      //const logResult = await this.logService.create(log);
      //return logResult;
      return log; //TODO: quitar este return dejar solo el de arriba.
    } catch (error) {
      console.log(error);
      console.log({ level, createdAt, message, meta });
      return { level, createdAt, message, meta };
    }
  }
}
