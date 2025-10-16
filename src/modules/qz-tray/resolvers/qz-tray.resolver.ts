import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { SignRequestDto } from '../dto/sign-request.dto';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { QZTrayService } from '../services/qz-tray.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { RoleGuard } from '../../auth/guards/role.guard';

@Resolver('QZTray')
export class QZTrayResolver {
  constructor(private readonly qzTrayService: QZTrayService) {}

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('getQZPublicKey')
  getPublicKey() {
    return this.qzTrayService.getPublicKey();
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.USER,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('signQZRequest')
  signRequest(@Args('request') request: string) {
    const signRequestDto: SignRequestDto = { request };
    return this.qzTrayService.signRequest(signRequestDto);
  }
}
