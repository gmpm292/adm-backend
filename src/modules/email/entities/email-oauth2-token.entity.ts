import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class EmailOAuth2Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  provider: string; // 'google'

  @Column({ type: 'text', nullable: false })
  encryptedRefreshToken: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accessToken: string;

  @Column({ type: 'timestamp', nullable: true })
  accessTokenExpiry: Date;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string; // email asociado al token

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
