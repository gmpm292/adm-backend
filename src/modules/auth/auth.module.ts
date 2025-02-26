import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';

import { AuthResolver } from './resolvers/auth.resolver';
import { AuthService } from './services/auth.service';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { ClassicLocalStrategy } from './strategies/classic-local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { MobileLocalStrategy } from './strategies/mobile-local.strategy';
import { AccessTokenSingleLoginStrategy } from './strategies/access-token-single-login.strategy';
import { NotificationModule } from '../notification/notification.module';
import { LoggerModule } from '../../common/logger';

@Module({
  imports: [
    JwtModule.register({}),
    PassportModule,
    LoggerModule,
    UsersModule,
    NotificationModule,
  ],
  providers: [
    AuthService,
    AuthResolver,
    ClassicLocalStrategy,
    MobileLocalStrategy,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    AccessTokenSingleLoginStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
