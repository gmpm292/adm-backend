/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../../users/services/users.service';

import { CurrentUser } from '../decorators/current-user.decorator';
import { LoginOutput } from '../dto/login-output';
import { JWTPayload } from '../dto/jwt-payload.dto';
import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { AccessTokenAuthGuard } from '../guards/access-token-auth.guard';
import { ClassicLocalAuthGuard } from '../guards/classic-local-auth.guard';
import { AuthService } from '../services/auth.service';
import { RefreshTokenAuthGuard } from '../guards/refresh-token-auth.guard';
import { MobileLocalAuthGuard } from '../guards/mobile-local-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RoleGuard } from '../guards/role.guard';
import { ImpersonalLoginInput } from '../dto/impersonal-login.input';
import { AccessTokenReason } from '../enums/access-token-reason';
import { NotProtectByTwoFactorAuth } from '../decorators/two-factor-auth.decorator';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../../core/enums/role.enum';

@Resolver()
export class AuthResolver {
  public constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private usersService: UsersService, //private workersService: WorkersService,
    //private readonly workerLogsService: WorkerLogsService,
  ) {}

  @UseGuards(ClassicLocalAuthGuard)
  @Query('classicLogin')
  public async classicLogin(
    @CurrentUser() user: User,
    @Context() context,
  ): Promise<LoginOutput> {
    const { res } = context;

    await this.usersService.chekCompanyInfo(user);

    const accessToken = this.authService.createAccessToken(user);
    // Check if user have active session and notifi close
    await this.authService.checkAndNotifyCloseActiveSession(user);
    // Adds access token to list or map of authorized tokens
    await this.authService.saveAccessToken(
      user,
      accessToken,
      AccessTokenReason.UserSingleLogin,
      context,
    );
    // Adds access token to cookies
    this.authService.addAccessTokenToCookies(accessToken, res);

    // Save refresh token and add to cookies
    const refreshToken = this.authService.createRefreshToken(user);
    await this.usersService.saveRefreshToken(user.id as number, refreshToken);
    this.authService.addRefreshTokenToCookies(refreshToken, res);

    return {
      accessToken,
      refreshToken,
      profile: user,
    };
  }

  @UseGuards(MobileLocalAuthGuard)
  @Query('mobileLogin')
  public async mobileLogin(
    @CurrentUser() user: User,
    @Context() context,
  ): Promise<LoginOutput> {
    const { res } = context;

    await this.usersService.chekCompanyInfo(user);

    const accessToken = this.authService.createAccessToken(user);
    // Check if user have active session and notifi close
    await this.authService.checkAndNotifyCloseActiveSession(user);
    // Adds access token to list or map of authorized tokens
    await this.authService.saveAccessToken(
      user,
      accessToken,
      AccessTokenReason.UserSingleLogin,
      context,
    );
    // Adds access token to cookies
    this.authService.addAccessTokenToCookies(accessToken, res);

    // Save refresh token and add to cookies
    const refreshToken = this.authService.createRefreshToken(user);
    await this.usersService.saveRefreshToken(user.id as number, refreshToken);
    this.authService.addRefreshTokenToCookies(refreshToken, res);

    return {
      accessToken,
      refreshToken,
      profile: user,
    };
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('impersonalLogin')
  public async impersonalLogin(
    @CurrentUser() user: JWTPayload,
    @Context() context,
    @Args('input') input: ImpersonalLoginInput,
  ): Promise<LoginOutput> {
    const { res } = context;

    this.logout(user, context);

    const newUser = await this.usersService.findOne(input.userId);
    await this.usersService.chekCompanyInfo(newUser);

    const accessToken = this.authService.createAccessToken(
      newUser,
      input.timeInSec,
      true,
    );
    // Adds access token to list or map of authorized tokens
    await this.authService.saveAccessToken(
      newUser,
      accessToken,
      AccessTokenReason.UserInspect,
      context,
    );
    // Adds access token to cookies
    this.authService.addAccessTokenToCookies(accessToken, res, input.timeInSec);

    // Add Log in WorkerLogs
    // this.workerLogsService.create({
    //   info: 'Impersonal Login',
    //   workerId: user.sub,
    // });

    return {
      accessToken,
      refreshToken: '',
      profile: newUser,
    };
  }

  @NotProtectByTwoFactorAuth()
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('logout')
  public async logout(
    @CurrentUser() payload: JWTPayload,
    @Context() context,
  ): Promise<User | Worker> {
    const { res } = context;
    // Remove access token from cookies
    res.clearCookie(AuthParameterKey.AccessToken);

    // Remove refresh token from cookies and database
    res.clearCookie(AuthParameterKey.RefreshToken);
    await this.usersService.saveRefreshToken(payload.sub, null);
    const user = await this.usersService.findOne(payload.sub);
    await this.authService.removeAccessToken(user);

    // Add Log in WorkerLogs
    // this.workerLogsService.create({ info: 'Logout', workerId: payload.sub });

    return user;
  }

  @UseGuards(RefreshTokenAuthGuard)
  @Mutation('refresh')
  public async refresh(
    @CurrentUser() user: User,
    @Context() context,
  ): Promise<Pick<LoginOutput, 'accessToken'>> {
    const { res, req } = context;
    const refreshPayload = req?.refreshPayload as JWTPayload;

    const accessToken = this.authService.createAccessToken(
      user,
      undefined,
      refreshPayload?.twoFactorAuthPassed ?? false,
    );
    // Adds access token to list or map of authorized tokens
    await this.authService.saveAccessToken(
      user,
      accessToken,
      AccessTokenReason.UserSingleLogin,
      context,
    );

    this.authService.addAccessTokenToCookies(accessToken, res);

    return { accessToken };
  }

  @NotProtectByTwoFactorAuth()
  @UseGuards(AccessTokenAuthGuard)
  @Query('verify2FA')
  public async verify2FA(
    @Args('token2fa') token2fa: string,
    @CurrentUser() user: JWTPayload,
    @Context() context,
  ): Promise<LoginOutput> {
    const userVerified = await this.authService.verify2FACode(
      user.sub,
      token2fa,
    );

    this.logout(user, context);

    // Generate final JWT after 2FA verification
    const { res } = context;
    const accessToken = this.authService.createAccessToken(
      userVerified,
      undefined,
      true,
    );
    // Check if user have active session and notifi close
    await this.authService.checkAndNotifyCloseActiveSession(userVerified);
    // Adds access token to list of authorized tokens
    await this.authService.saveAccessToken(
      userVerified,
      accessToken,
      AccessTokenReason.UserSingleLogin,
      context,
    );
    // Adds access token to cookies
    this.authService.addAccessTokenToCookies(accessToken, res);

    // Save refresh token and add to cookies
    const refreshToken = this.authService.createRefreshToken(
      userVerified,
      undefined,
      true,
    );
    await this.usersService.saveRefreshToken(
      userVerified.id as number,
      refreshToken,
    );
    this.authService.addRefreshTokenToCookies(refreshToken, res);

    // Add Log in WorkerLogs
    // this.workerLogsService.create({
    //   info: 'Verify2FA',
    //   workerId: userVerified.id,
    // });

    return {
      accessToken,
      refreshToken,
      profile: userVerified,
    };
  }

  @NotProtectByTwoFactorAuth()
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('generate2faSecret')
  async generate2FASecret(@CurrentUser() user: JWTPayload) {
    const secret = await this.authService.generate2FASecret(user);

    return secret;
  }

  @NotProtectByTwoFactorAuth()
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('finishConfigure2FA')
  async finishConfigure2FA(
    @CurrentUser() user: JWTPayload,
    @Args('token2fa') token2fa: string,
  ) {
    const userEnabled = await this.authService.finishConfigure2FA(
      user.sub,
      token2fa,
    );

    return Boolean(userEnabled);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('reset2FASettings')
  async reset2FASettings(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ) {
    const userRes = await this.authService.reset2FASettings(id);
    return Boolean(userRes);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('enable2FA')
  async enable2FA(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    const userRes = await this.authService.enable2FA(id);
    return Boolean(userRes);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard)
  @Mutation('disable2FA')
  async disable2FA(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    const userRes = await this.authService.disable2FA(id);
    return Boolean(userRes);
  }
}
