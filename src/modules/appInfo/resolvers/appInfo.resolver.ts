import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { AppInfoService } from '../services/appInfo.service';
import { AppInfo } from '../models/app-info.model';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';

@Resolver(() => AppInfo)
export class AppInfoResolver {
  constructor(private readonly appInfoService: AppInfoService) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('appInfo')
  appInfo() {
    return this.appInfoService.appInfo();
  }
}
