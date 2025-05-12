import { Entity, ManyToOne, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../../core/entities/base.entity';

import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { EntityStatus } from '../../../core/enums/entity-status.enum';
import { Business } from '../../company/business/entities/co_business.entity';
import { RoleGuardEntity } from '../../role-guard-resource/entities/role-guard.entity';

@Entity('scoped_access')
@Unique(['business', 'roleGuard'])
export class ScopedAccessEntity extends BaseEntity {
  @ManyToOne(() => Business, (business) => business.scopedAccesses, {
    onDelete: 'CASCADE',
  })
  business: Business;

  @ManyToOne(() => RoleGuardEntity, (roleGuard) => roleGuard.scopedAccesses, {
    onDelete: 'CASCADE',
  })
  roleGuard: RoleGuardEntity;

  @Column({
    type: 'enum',
    enum: ScopedAccessEnum,
    array: true,
    default: [ScopedAccessEnum.BUSINESS],
  })
  accessLevels: ScopedAccessEnum[];

  @Column({
    type: 'enum',
    nullable: true,
    enum: EntityStatus,
    default: EntityStatus.ENABLED,
  })
  public entityStatus?: EntityStatus;
}
