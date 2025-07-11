/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { OAuth2Service } from '../servises/oauth2.service';
import { ConfigService } from '../../../common/config';
import { EmailHealthService } from '../servises/email-health.service';

@Resolver('OAuth2')
export class EmailOAuthResolver {
  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly configService: ConfigService,
    private readonly healthService: EmailHealthService,
  ) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('oauth2InitEmailAuth')
  async initAuth(@CurrentUser() user: JWTPayload) {
    try {
      const authUrl = await this.oauth2Service.generateAuthUrl();
      return {
        url: authUrl,
        clientId: this.configService.get('EMAIL_CLIENT_ID'),
        redirectUri: this.configService.get('EMAIL_REDIRECT_URI'),
      };
    } catch (error) {
      throw new Error(`Failed to generate auth URL: ${error.message}`);
    }
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('oauth2EmailCallback')
  async callback(@CurrentUser() user: JWTPayload, @Args('code') code: string) {
    const result = await this.oauth2Service.handleCallback(code);
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('oauth2EmailStatus')
  async getStatus(@CurrentUser() user: JWTPayload) {
    return this.oauth2Service.getCurrentTokenStatus();
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('emailHealthStatus')
  async checkStatus(@CurrentUser() user: JWTPayload) {
    return this.healthService.checkEmailStatus();
  }
}
