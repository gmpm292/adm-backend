import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';
import { TeamTypeEnum } from '../enums/team-types.enum';
import { Department } from '../../department/entities/co_department.entity';
import { User } from '../../../users/entities/user.entity';

@Entity('co_teams')
export class Team extends BaseEntity {
  @Column({
    type: 'enum',
    enum: TeamTypeEnum,
    nullable: true,
    default: null,
  })
  teamType: TeamTypeEnum;

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
