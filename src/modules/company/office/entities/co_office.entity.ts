import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { OfficeType } from '../enums/office-type.enum';
import { BaseEntity } from '../../../../core/entities/base.entity';
import { User } from '../../../users/entities/user.entity';
import { Department } from '../../department/entities/co_department.entity';
import { Business } from '../../business/entities/co_business.entity';

@Entity('co_offices')
export class Office extends BaseEntity {
  @ManyToOne(() => Business, (business) => business.offices)
  business: Business;

  @Column({
    type: 'enum',
    enum: OfficeType,
    default: OfficeType.OFFICE,
    nullable: true,
  })
  officeType: OfficeType;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  address?: string;

  @OneToMany(() => Department, (department) => department.office, {
    cascade: ['soft-remove', 'recover'],
  })
  departments?: Department[];

  @OneToMany(() => User, (u) => u.office, {
    cascade: ['soft-remove', 'recover'],
  })
  users?: User[];
}
