import {
  Column,
  Entity,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConfigCategory } from '../enums/config-category.enum';
import { ConfigVisibility } from '../enums/config-visibility.enum';
import { ConfigStatus } from '../enums/config-status.enum';

@Entity('config')
export class Config {
  @PrimaryGeneratedColumn()
  public id?: number;

  @CreateDateColumn()
  public createdAt?: Date;

  @DeleteDateColumn()
  public deletedAt?: Date;

  @UpdateDateColumn()
  public updatedAt?: Date;

  @Column({
    type: 'enum',
    nullable: false,
    enum: ConfigCategory,
    default: ConfigCategory.GENERAL,
  })
  public category: ConfigCategory;

  @Column('varchar', { unique: true })
  public group: string;

  @Column('varchar', { nullable: true })
  public description: string;

  @Column('jsonb', { nullable: true, default: null })
  public values: Record<string, unknown>;

  @Column({
    type: 'enum',
    nullable: false,
    enum: ConfigVisibility,
    default: ConfigVisibility.PUBLIC,
  })
  public configVisibility?: ConfigVisibility;

  @Column({
    type: 'enum',
    nullable: true,
    enum: ConfigStatus,
    default: ConfigStatus.ENABLED,
  })
  public configStatus?: ConfigStatus;
}
