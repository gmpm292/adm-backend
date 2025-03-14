import { Column, Entity, ManyToOne } from 'typeorm';
import { IsBoolean, IsDate, IsUUID } from 'class-validator';
import { User } from './user.entity';
import { BaseEntity } from '../../../core/entities/base.entity';

@Entity('users_confirmationTokens')
export class ConfirmationToken extends BaseEntity {
  @ManyToOne(() => User, (user) => user.confirmationTokens, {
    cascade: false,
  })
  user: User;

  //@IsJWT()
  @IsUUID()
  @Column({ nullable: true })
  tokenValue: string;

  @IsDate()
  @Column()
  expirationDate: Date;

  @IsBoolean()
  @Column()
  used: boolean;
}
