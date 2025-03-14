import { IsEmail, IsPhoneNumber, IsString } from 'class-validator';
import { Column, Entity, Index, OneToMany, TableInheritance } from 'typeorm';

import { BaseEntity } from '../../../core/entities/base.entity';
import { Role } from '../../../core/enums/role.enum';
import { ConfirmationToken } from './confirmation-token.entity';
import { NotificationLog } from '../../notification/entities/notification-log.entity';

@Entity('users')
@TableInheritance({
  column: { type: 'varchar', name: 'type', default: 'User' },
})
export class User extends BaseEntity {
  @OneToMany(
    () => ConfirmationToken,
    (confirmationToken) => confirmationToken.user,
    {
      cascade: false,
      nullable: true,
    },
  )
  public confirmationTokens?: ConfirmationToken[];

  //Onli for system use
  public confirmationToken?: string;

  @IsEmail()
  @Column({ unique: true })
  public email: string;

  @Column({ default: false })
  public enabled?: boolean;

  @Column()
  public name: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  fullName?: string;

  @IsPhoneNumber()
  @Column({ unique: true })
  @Index()
  public mobile: string;

  @Column({ nullable: true })
  public password?: string;

  @Column({ nullable: true })
  public refreshToken?: string;

  // @IsEnum(Role, { each: true })
  // @ArrayNotEmpty()
  @IsString()
  @Column({ type: 'text', array: true, default: [] })
  public role?: Role[];

  @Column({ nullable: true })
  twoFASecret?: string;

  @Column({ default: false })
  isTwoFactorEnabled?: boolean;

  @Column({ default: false })
  isTwoFactorConfigured?: boolean;

  @OneToMany(() => NotificationLog, (notificationLog) => notificationLog.user)
  notificationLogs?: NotificationLog[];

  /*
   * Worker attributes.
   */
  // @ManyToOne(() => Office, {
  //   nullable: true,
  // })
  office?: any; //Office;

  // @ManyToOne(() => Department, {
  //   nullable: true,
  // })
  department?: any; //Department;

  // @ManyToOne(() => Team, {
  //   nullable: true,
  // })
  team?: any; //Team;
}
