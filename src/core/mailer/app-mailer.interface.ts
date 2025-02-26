import { User } from '../../modules/users/entities/user.entity';

export abstract class IAppMailer {
  public abstract notifyUserCreation(user: User): Promise<any>;
  public abstract notifyPasswordRecovery(user: User): Promise<any>;
  public abstract notifySuccessSettingPassword(user: User): Promise<any>;

  public abstract notifyCustomerCreation(user: User): Promise<any>;

  /*
   * Notification User (Send Email To User)
   */
  public abstract notifyUserGeneral(
    email: string,
    subject: string,
    message: string,
  ): Promise<any>;
}
