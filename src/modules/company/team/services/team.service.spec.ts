import { Test, TestingModule } from '@nestjs/testing';
import { TeamService } from './team.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DepartmentService } from '../../department/services/department.service';

import { Team } from '@app/shared/entities';

describe('TeamService', () => {
  let service: TeamService;

  const mockDepartmentService = {};

  const mockTeamRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        DepartmentService,

        {
          provide: getRepositoryToken(Team),
          useValue: mockTeamRepository,
        },
      ],
    })
      .overrideProvider(DepartmentService)
      .useValue(mockDepartmentService)

      .compile();

    service = module.get<TeamService>(TeamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
