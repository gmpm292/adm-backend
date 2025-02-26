import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  public id?: number;

  @CreateDateColumn()
  public createdAt?: Date;

  @DeleteDateColumn()
  public deletedAt?: Date;

  @UpdateDateColumn()
  public updatedAt?: Date;
}
