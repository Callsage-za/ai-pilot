import { Test, TestingModule } from '@nestjs/testing';
import { JiraTicketsService } from './jira-tickets.service';

describe('JiraTicketsService', () => {
  let service: JiraTicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JiraTicketsService],
    }).compile();

    service = module.get<JiraTicketsService>(JiraTicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
