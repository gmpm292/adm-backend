import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IAppMailer } from './app-mailer.interface';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from '../../modules/email/servises/email.service';
import { SendEmailInput } from '../../modules/email/dto/send-email.input';
import { ConfigService } from '../../common/config';

/**
 * Correos de la aplicación sobre `EmailService`, con plantillas por nombre.
 * Si el envío falla, se escribe en consola y el error se relanza.
 */
@Injectable()
export class AppMailerService implements IAppMailer {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly emailService: EmailService,
    private readonly confServ: ConfigService,
  ) {}

  /**
   * Aviso de alta. Si el usuario tiene token de confirmación, incluye el
   * enlace para fijar la contraseña y cuántas horas vale.
   */
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

  /** Enlace para recuperar la contraseña (`FRONTEND_CHANGE_PASSWORD_URL`). */
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

  /** Confirma al usuario que su contraseña quedó fijada. */
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

  /**
   * Bienvenida a un cliente. Nadie la llama hoy; usa `FRONTEND_URL`, que no
   * está entre las variables declaradas.
   */
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

  /** Correo libre (asunto y texto), sin plantilla. */
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
