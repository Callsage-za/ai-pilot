import { Test, TestingModule } from '@nestjs/testing';
import { ElasticController } from './elastic.controller';

describe('ElasticController', () => {
  let controller: ElasticController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElasticController],
    }).compile();

    controller = module.get<ElasticController>(ElasticController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
