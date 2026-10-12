import { User } from '../../modules/users/entities/user.entity';

/**
 * Avisos por correo de la aplicación. Se inyecta por esta clase y
 * `AppMailerModule` decide la implementación (`AppMailerService`).
 */
export abstract class IAppMailer {
  public abstract notifyUserCreation(user: User): Promise<any>;
  public abstract notifyPasswordRecovery(user: User): Promise<any>;
  public abstract notifySuccessSettingPassword(user: User): Promise<any>;
  public abstract notifyCustomerCreation(user: User): Promise<any>;
  public abstract notifyUserGeneral(
    email: string,
    subject: string,
    message: string,
  ): Promise<any>;
}
