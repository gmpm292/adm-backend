import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';
import { DepartmentType } from '../enums/department-type.enum';
import { Office } from '../../office/entities/co_office.entity';
import { User } from '../../../users/entities/user.entity';
import { Team } from '../../team/entities/co_team.entity';

@Entity('co_departments')
export class Department extends BaseEntity {
  @Column({
    enum: DepartmentType,
    type: 'enum',
    nullable: true,
    default: null,
  })
  public departmentType: DepartmentType;

  @OneToMany(() => Team, (team) => team.department, {
    nullable: true,
    cascade: ['soft-remove', 'recover'],
  })
  public teams?: Team[];

  @ManyToOne(() => Office, (office) => office.departments, {
    eager: true,
    cascade: ['insert', 'update'],
  })
  public office: Office;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  address?: string;

  @OneToMany(() => User, (u) => u.department, {
    cascade: ['soft-remove', 'recover'],
  })
  users?: User[];
}
