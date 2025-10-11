import { Test, TestingModule } from '@nestjs/testing';
import { SocketGatewayController } from './socket-gateway.controller';

describe('SocketGatewayController', () => {
  let controller: SocketGatewayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocketGatewayController],
    }).compile();

    controller = module.get<SocketGatewayController>(SocketGatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
