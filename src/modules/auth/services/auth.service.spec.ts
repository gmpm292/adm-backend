import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '../../../common/config/config.service';
import { JwtService } from '@nestjs/jwt';
import { AppLoggerService } from '../../../common/logger/logger.service';
import { UsersService } from '../../users/services/users.service';

describe('AuthService', () => {
  let service: AuthService;

  let configService: ConfigService;
  configService;
  let jwtService: JwtService;
  jwtService;
  let loggerService: AppLoggerService;
  loggerService;
  let usersService: UsersService;
  usersService;

  const mockConfigService = {};
  const mockJwtService = {};
  const mockLoggerService = {};
  const mockUsersService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ConfigService,
        JwtService,
        AppLoggerService,
        UsersService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(JwtService)
      .useValue(mockJwtService)
      .overrideProvider(AppLoggerService)
      .useValue(mockLoggerService)
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
