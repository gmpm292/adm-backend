import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Role } from '../enums/role.enum';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class SystemUtilsService {
  private systemUser: User;

  constructor(private readonly entityManager: EntityManager) {}

  public async loadSystemUser(): Promise<void> {
    this.systemUser = await this.ensureSystemUserExists();
  }

  public getSystemUser(): User {
    if (!this.systemUser) throw new Error('System user not loaded!');
    return this.systemUser;
  }

  private async ensureSystemUserExists(): Promise<User> {
    let user = await this.entityManager.findOne(User, {
      where: { email: 'system@admin.com' },
      withDeleted: true,
    });
    if (!user) {
      user = this.entityManager.create(User, {
        email: 'system@admin.com',
        mobile: '12345678',
        name: 'System',
        lastName: 'User',
        fullName: 'System User',
        role: [Role.SUPER],
        enabled: true,
      });
      await this.entityManager.save(user);
    }
    return user;
  }
}
