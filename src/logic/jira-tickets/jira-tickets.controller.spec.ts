import { Test, TestingModule } from '@nestjs/testing';
import { JiraTicketsController } from './jira-tickets.controller';

describe('JiraTicketsController', () => {
  let controller: JiraTicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JiraTicketsController],
    }).compile();

    controller = module.get<JiraTicketsController>(JiraTicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
