import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_relations')
export class UserRelation extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column() // Type of entity (ej: 'Business', 'Office')
  entityType: string;

  @Column() // ID of entity.
  entityId: number;

  @Column({ nullable: true })
  relationType?: string; // Ej: 'owner', 'editor', 'viewer'
}
