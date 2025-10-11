import { Test, TestingModule } from '@nestjs/testing';
import { SocketGatewayService } from './socket-gateway.service';

describe('SocketGatewayService', () => {
  let service: SocketGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocketGatewayService],
    }).compile();

    service = module.get<SocketGatewayService>(SocketGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
