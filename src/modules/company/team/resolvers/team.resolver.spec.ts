import { Test, TestingModule } from '@nestjs/testing';
import { TeamResolver } from './team.resolver';
import { TeamService } from '../services/team.service';
import { TeamAccessLevelService } from '../services/team-access-level.service';

describe('TeamResolver', () => {
  let resolver: TeamResolver;
  const mockTeamAccessLevelService = {};

  const mockService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamResolver,
        TeamService,
        {
          provide: TeamAccessLevelService,
          useValue: mockTeamAccessLevelService,
        },
      ],
    })
      .overrideProvider(TeamService)
      .useValue(mockService)
      .compile();

    resolver = module.get<TeamResolver>(TeamResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
