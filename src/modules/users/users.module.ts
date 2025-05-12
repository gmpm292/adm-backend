import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfirmationTokenService } from './confirmationToken/services/confirmation-token.service';
import { UsersResolver } from './resolvers/users.resolver';
import { UserAccessLevelService } from './services/user-access-level.service';
import { UsersService } from './services/users.service';

import { User } from './entities/user.entity';
import { ConfirmationToken } from './entities/confirmation-token.entity';
import { GraphqlModule } from '../../common/graphql/graphql.module';
import { LoggerModule } from '../../common/logger';
import { ConfigModule } from '../../common/config';
import { CoreModule } from '../../core/core.module';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      User,
      //Office,
      //Department,
      //Team,
      ConfirmationToken,
    ]),
    GraphqlModule,
    //AppMailerModule,
    LoggerModule,
    ConfigModule,
    //CustomerHistoryModule,
    //LeadCenterModule,
    CoreModule,
  ],
  providers: [
    UsersResolver,
    //CustomeResolver,
    UsersService,
    ConfirmationTokenService,
    UserAccessLevelService,
  ],
  exports: [
    //CustomeResolver,
    UsersService,
  ],
})
export class UsersModule {}
