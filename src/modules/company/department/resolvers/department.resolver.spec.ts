import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentResolver } from './department.resolver';
import { DepartmentService } from '../services/department.service';
import { DepartmentAccessLevelService } from '../services/department-access-level.service';

describe('DepartmentResolver', () => {
  let resolver: DepartmentResolver;
  const mockDepartmentAccessLevelService = {};

  const mockService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentResolver,
        DepartmentService,
        {
          provide: DepartmentAccessLevelService,
          useValue: mockDepartmentAccessLevelService,
        },
      ],
    })
      .overrideProvider(DepartmentService)
      .useValue(mockService)
      .compile();

    resolver = module.get<DepartmentResolver>(DepartmentResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
