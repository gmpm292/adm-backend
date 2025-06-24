import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TelegramMessageType } from '../enums/telegram-message-type.enum';

@Entity()
export class TelegramTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: TelegramMessageType,
    default: TelegramMessageType.TEXT,
  })
  messageType: TelegramMessageType;

  @Column({ type: 'jsonb', nullable: true })
  defaultContext?: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
