import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OfficeResolver } from './resolvers/office.resolver';
import { OfficeService } from './services/office.service';
import { Office } from './entities/co_office.entity';
import { User } from '../../users/entities/user.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Office, User])],
  providers: [OfficeResolver, OfficeService],
  exports: [OfficeResolver, OfficeService],
})
export class OfficeModule {}
