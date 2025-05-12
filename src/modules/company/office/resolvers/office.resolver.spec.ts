import { Test, TestingModule } from '@nestjs/testing';
import { OfficeResolver } from './office.resolver';
import { OfficeService } from '../services/office.service';
import { OfficeAccessLevelService } from '../services/office-access-level.service';

describe('OfficeResolver', () => {
  let resolver: OfficeResolver;
  const mockOfficeAccessLevelService = {};

  const mockService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfficeResolver,
        OfficeService,
        {
          provide: OfficeAccessLevelService,
          useValue: mockOfficeAccessLevelService,
        },
      ],
    })
      .overrideProvider(OfficeService)
      .useValue(mockService)
      .compile();

    resolver = module.get<OfficeResolver>(OfficeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
