import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Department, Office } from '@app/shared/entities';
describe('DepartmentService', () => {
  let service: DepartmentService;

  const mockDepartmentRepository = {};
  const mockOfficeRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: getRepositoryToken(Department),
          useValue: mockDepartmentRepository,
        },
        {
          provide: getRepositoryToken(Office),
          useValue: mockOfficeRepository,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
