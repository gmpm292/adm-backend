import { IsEmail, IsPhoneNumber, IsString } from 'class-validator';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  TableInheritance,
} from 'typeorm';

import { Role } from '../../../core/enums/role.enum';
import { ConfirmationToken } from './confirmation-token.entity';
import { NotificationLog } from '../../notification/entities/notification-log.entity';
import { BaseEntity } from '../../../core/entities/base.entity';
import { Business } from '../../company/business/entities/co_business.entity';
import { Office } from '../../company/office/entities/co_office.entity';
import { Department } from '../../company/department/entities/co_department.entity';
import { Team } from '../../company/team/entities/co_team.entity';
import { UserRelation } from '../../user-relation/entities/user-relation.entity';

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

  @ManyToOne(() => User, {
    nullable: true,
  })
  public createdBy?: User;

  @ManyToOne(() => User, {
    nullable: true,
  })
  public deletedBy?: User;

  @ManyToOne(() => User, {
    nullable: true,
  })
  public updatedBy?: User;

  @ManyToOne(() => Business, {
    nullable: true,
  })
  business?: Business;

  @ManyToOne(() => Office, {
    nullable: true,
  })
  office?: Office;

  @ManyToOne(() => Department, {
    nullable: true,
  })
  department?: Department;

  @ManyToOne(() => Team, {
    nullable: true,
  })
  team?: Team;
}
