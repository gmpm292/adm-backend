import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from '../services/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/services/users.service';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: AuthService;
  authService;
  let jwtService: JwtService;
  jwtService;
  let usersService: UsersService;
  usersService;

  const mockAuthService = {};
  const mockJwtService = {};
  const mockUsersService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthResolver, AuthService, JwtService, UsersService],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .overrideProvider(JwtService)
      .useValue(mockJwtService)
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
