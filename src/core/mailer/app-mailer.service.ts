import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IAppMailer } from './app-mailer.interface';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from '../../modules/email/servises/email.service';
import { SendEmailInput } from '../../modules/email/dto/send-email.input';
import { ConfigService } from '../../common/config';

@Injectable()
export class AppMailerService implements IAppMailer {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly emailService: EmailService,
    private readonly confServ: ConfigService,
  ) {}

  public async notifyUserCreation(user: User): Promise<any> {
    try {
      const templateId = 'user-creation'; // Name de la plantilla en la base de datos

      const confirmationToken = user.confirmationToken;
      const setPasswordLink = `${this.confServ.get('FRONTEND_CHANGE_PASSWORD_URL')}/${confirmationToken}`;
      const expirationTime = `${(this.confServ.get('CONFIRMATION_TOKEN_EXPIRE_IN') || 86400) / 60 / 60} horas`;

      let context: Record<string, any> = {
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        companyName: user.business?.name || 'Nuestra compañía',
        date: new Date().toLocaleDateString(),
      };
      if (confirmationToken) {
        context = { ...context, setPasswordLink, expirationTime };
      }

      return await this.emailService.sendEmail({
        to: user.email,
        templateId,
        context,
      } as SendEmailInput);
    } catch (error) {
      console.error('Failed to send user creation email', error);
      throw error;
    }
  }

  public async notifyPasswordRecovery(user: User): Promise<any> {
    try {
      const templateId = 'password-recovery';
      const recoveryLink = `${this.confServ.get('FRONTEND_CHANGE_PASSWORD_URL')}/${user.confirmationToken}`;
      const expirationTime = `${(this.confServ.get('CONFIRMATION_TOKEN_EXPIRE_IN') || 86400) / 60 / 60} horas`;

      const context = {
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        companyName: user.business?.name || 'Nuestra compañía',
        recoveryLink,
        expirationTime,
      };

      return await this.emailService.sendEmail({
        to: user.email,
        templateId,
        context,
      } as SendEmailInput);
    } catch (error) {
      console.error('Failed to send password recovery email', error);
      throw error;
    }
  }

  public async notifySuccessSettingPassword(user: User): Promise<any> {
    try {
      const templateId = 'password-set-success';
      const context = {
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        companyName: user.business?.name || 'Nuestra compañía',
        date: new Date().toLocaleDateString(),
      };

      return await this.emailService.sendEmail({
        to: user.email,
        templateId,
        context,
      } as SendEmailInput);
    } catch (error) {
      console.error('Failed to send password set success email', error);
      throw error;
    }
  }

  public async notifyCustomerCreation(user: User): Promise<any> {
    try {
      const templateId = 'customer-welcome';
      const loginLink = `${process.env.FRONTEND_URL}/login`;

      const context = {
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        companyName: user.business?.name || 'Nuestra compañía',
        loginLink,
        temporaryPassword: user.password, // Solo si se envía contraseña temporal
      };

      return await this.emailService.sendEmail({
        to: user.email,
        templateId,
        context,
      } as SendEmailInput);
    } catch (error) {
      console.error('Failed to send customer creation email', error);
      throw error;
    }
  }

  public async notifyUserGeneral(
    email: string,
    subject: string,
    message: string,
  ): Promise<any> {
    try {
      return await this.emailService.sendEmail({
        to: email,
        subject,
        body: message,
      } as SendEmailInput);
    } catch (error) {
      console.error('Failed to send general notification email', error);
      throw error;
    }
  }
}
