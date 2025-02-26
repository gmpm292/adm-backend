import { Test, TestingModule } from '@nestjs/testing';
import { AppInfoResolver } from './appInfo.resolver';
import { AppInfoService } from '../services/appInfo.service';
import { LoggerService } from '../../../common/logger';
import { LogService } from '../../../common/logger/log/services/log.service';
import { getModelToken } from '@nestjs/mongoose';

describe('AppInfoResolver', () => {
  let resolver: AppInfoResolver;
  let loggerService: LoggerService;
  let logService: LogService;
  const mockRedisPubSub = {};
  const mockLoggerService = {};
  const mockLogService = {};
  const mockLogModel = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppInfoService,
        AppInfoResolver,
        LoggerService,
        LogService,
        {
          provide: getModelToken('log'),
          useValue: mockLogModel,
        },
        {
          provide: 'REDIS_PUB_SUB_TOKEN',
          useValue: mockRedisPubSub,
        },
      ],
    })
      .overrideProvider(loggerService)
      .useValue(mockLoggerService)
      .overrideProvider(logService)
      .useValue(mockLogService)
      .compile();

    resolver = module.get<AppInfoResolver>(AppInfoResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
