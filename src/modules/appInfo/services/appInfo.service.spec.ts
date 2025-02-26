import { Test, TestingModule } from '@nestjs/testing';
import { AppInfoService } from './appInfo.service';
import { LoggerService } from '../../../common/logger';

describe('AppInfoService', () => {
  let service: AppInfoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppInfoService,
        {
          provide: 'REDIS_PUB_SUB_TOKEN',
          useValue: {},
        },
        {
          provide: LoggerService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AppInfoService>(AppInfoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
