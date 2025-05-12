/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Business } from '../../modules/company/business/entities/co_business.entity';
import { Office } from '../../modules/company/office/entities/co_office.entity';
import { Department } from '../../modules/company/department/entities/co_department.entity';
import { Team } from '../../modules/company/team/entities/co_team.entity';
import { BaseEntity } from './base.entity';
import { UserRelation } from '../../modules/user-relation/entities/user-relation.entity';

export abstract class SecurityBaseEntity extends BaseEntity {
  @ManyToOne(() => User, {
    nullable: true,
  })
  public createdBy?: User;

  @ManyToOne(() => User, {
    nullable: true,
  })
  public deletedBy?: User;

  @ManyToOne(() => User, {
    nullable: true,
  })
  public updatedBy?: User;

  @ManyToOne(() => Business, {
    nullable: true,
  })
  business?: Business;

  @ManyToOne(() => Office, {
    nullable: true,
  })
  office?: Office;

  @ManyToOne(() => Department, {
    nullable: true,
  })
  department?: Department;

  @ManyToOne(() => Team, {
    nullable: true,
  })
  team?: Team;

  @OneToMany(
    () => UserRelation,
    (relation) =>
      relation.entityId &&
      relation.entityType === (this as any).constructor.name,
    {
      cascade: true,
    },
  )
  userRelations?: UserRelation[];
}
