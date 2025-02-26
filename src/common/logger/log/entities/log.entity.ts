import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';

@Entity('logs')
export class Log extends BaseEntity {
  @Column()
  level: string;

  @Column()
  message: string;

  @Column('json', { default: {} })
  meta: any;

  @Column({ nullable: true })
  userId?: number;

  @Column({ nullable: true })
  intServErrorId?: string;
}
