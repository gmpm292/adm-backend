import { ArrayNotEmpty, IsEnum, IsString } from 'class-validator';
import { BaseEntity } from '../../../core/entities/base.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { Role } from '../../../core/enums/role.enum';
import { EntityStatus } from '../../../core/enums/entity-status.enum';
import { ScopedAccessEntity } from '../../scoped-access/entities/scoped-access.entity';

@Entity('RoleGuardEntity')
export class RoleGuardEntity extends BaseEntity {
  @IsString()
  @Column('varchar', { unique: true })
  public queryOrEndPointURL: string;

  @IsString()
  @Column('varchar', { default: '' })
  public type?: string;

  @IsString()
  @Column('varchar', { default: '' })
  public description?: string;

  @IsEnum(Role, { each: true })
  @ArrayNotEmpty()
  @Column({
    type: 'enum',
    enum: Role,
    array: true,
    nullable: true,
    default: null,
  })
  public roles?: Role[];

  @Column({
    type: 'enum',
    nullable: true,
    enum: EntityStatus,
    default: EntityStatus.ENABLED,
  })
  public entityStatus?: EntityStatus;

  @OneToMany(() => ScopedAccessEntity, (scopedAccess) => scopedAccess.roleGuard)
  scopedAccesses?: ScopedAccessEntity[];
}
