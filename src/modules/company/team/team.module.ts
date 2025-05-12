import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeamService } from './services/team.service';
import { TeamResolver } from './resolvers/team.resolver';
import { Team } from './entities/co_team.entity';
import { User } from '../../users/entities/user.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Team, User])],
  providers: [TeamResolver, TeamService],
  exports: [TeamResolver, TeamService],
})
export class TeamModule {}
