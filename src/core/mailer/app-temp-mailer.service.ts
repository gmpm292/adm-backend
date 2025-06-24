import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IAppMailer } from './app-mailer.interface';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class AppTempMailerService implements IAppMailer {
  constructor(private readonly entityManager: EntityManager) {}

  public notifyUserCreation(user: User): Promise<any> {
    throw new Error('Method not implemented.');
  }

  public notifyPasswordRecovery(user: User): Promise<any> {
    throw new Error('Method not implemented.');
  }

  public notifySuccessSettingPassword(user: User): Promise<any> {
    throw new Error('Method not implemented.');
  }

  public notifyCustomerCreation(user: User): Promise<any> {
    throw new Error('Method not implemented.');
  }

  public notifyUserGeneral(
    email: string,
    subject: string,
    message: string,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
