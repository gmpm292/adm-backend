import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { TelegramMessageType } from '../enums/telegram-message-type.enum';
import { TelegramStatus } from '../enums/telegram-status.enum';
import { TelegramError } from '../enums/telegram-error.interface';

@Entity()
export class TelegramMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  chatId: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @ManyToOne(() => User)
  sender: User;

  @Column({ type: 'jsonb', nullable: true })
  recipients?: Array<{
    chatId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }>;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: TelegramMessageType,
    default: TelegramMessageType.TEXT,
  })
  messageType: TelegramMessageType;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: Array<{
    type: string;
    url: string;
    caption?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: TelegramStatus,
    default: TelegramStatus.PENDING,
  })
  status: TelegramStatus;

  @Column({ type: 'jsonb', nullable: true })
  error?: TelegramError;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt?: Date;

  @Column({ nullable: true })
  templateId?: string;

  @Column()
  botTokenKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
