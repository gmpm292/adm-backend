import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailProvider } from '../enums/email-provider.enum';

@Entity()
export class Email {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column({ nullable: true })
  cc?: string;

  @Column({ nullable: true })
  bcc?: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ nullable: true, type: 'text' })
  body?: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any>;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
  status: EmailStatus;

  @Column({ type: 'enum', enum: EmailProvider })
  provider: EmailProvider;

  @Column({ nullable: true })
  templateId?: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: Array<{
    filename: string;
    path: string;
    cid?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
