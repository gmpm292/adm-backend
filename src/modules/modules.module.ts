import { Module } from '@nestjs/common';
import { AppInfoModule } from './appInfo/appInfo.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoleGuardModule } from './role-guard-resource/role-guard.module';

@Module({
  imports: [AppInfoModule, UsersModule, AuthModule, RoleGuardModule],
  providers: [],
})
export class Modules {}
