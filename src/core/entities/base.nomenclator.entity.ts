import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class BaseNomenclatorEntity extends BaseEntity {
  @Column('varchar', { unique: true })
  public name: string;

  @Column('varchar', { nullable: true })
  public color: string;

  @Column('boolean', { default: true })
  active?: boolean;
}
