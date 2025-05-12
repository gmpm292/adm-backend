import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';
import { Office } from '../../office/entities/co_office.entity';
import { ScopedAccessEntity } from '../../../scoped-access/entities/scoped-access.entity';

@Entity('co_businesses')
export class Business extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  taxId: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  contactEmail: string;

  @OneToMany(() => Office, (office) => office.business, {
    cascade: ['soft-remove', 'recover'],
  })
  offices?: Office[];

  @OneToMany(() => ScopedAccessEntity, (scopedAccess) => scopedAccess.business)
  scopedAccesses?: ScopedAccessEntity[];
}
