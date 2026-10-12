import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Role } from '../enums/role.enum';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Usuario del sistema (`system@admin.com`), con el que actúan las tareas
 * automáticas. Se carga al arrancar (`CoreModule`).
 */
@Injectable()
export class SystemUtilsService {
  private systemUser: User;

  constructor(private readonly entityManager: EntityManager) {}

  public async loadSystemUser(): Promise<void> {
    this.systemUser = await this.ensureSystemUserExists();
  }

  /** Lanza si se pide antes de que `CoreModule` lo cargue. */
  public getSystemUser(): User {
    if (!this.systemUser) throw new Error('System user not loaded!');
    return this.systemUser;
  }

  /**
   * Lo busca (también entre eliminados) y, si no está, lo crea como SUPER
   * sin contraseña. Normalmente ya lo crearon las migraciones.
   */
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
