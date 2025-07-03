import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';
import { TeamTypeEnum } from '../enums/team-types.enum';
import { Department } from '../../department/entities/co_department.entity';
import { User } from '../../../users/entities/user.entity';
import { Business } from '../../business/entities/co_business.entity';
import { Office } from '../../office/entities/co_office.entity';

@Entity('co_teams')
export class Team extends BaseEntity {
  @Column({
    type: 'enum',
    enum: TeamTypeEnum,
    nullable: true,
    default: null,
  })
  teamType: TeamTypeEnum;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToOne(() => Business, (business) => business.offices)
  business: Business;

  @ManyToOne(() => Office, (office) => office.departments)
  office: Office;

  @ManyToOne(() => Department, (department) => department.teams, {
    eager: true,
    cascade: ['insert', 'update'],
  })
  @JoinColumn()
  department: Department;

  //Bidereccional
  @OneToMany(() => User, (u) => u.team, {
    cascade: ['soft-remove', 'recover'],
  })
  users?: User[];
}
