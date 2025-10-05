import { Test, TestingModule } from '@nestjs/testing';
import { ChatMemoryController } from './chat-memory.controller';

describe('ChatMemoryController', () => {
  let controller: ChatMemoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatMemoryController],
    }).compile();

    controller = module.get<ChatMemoryController>(ChatMemoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
