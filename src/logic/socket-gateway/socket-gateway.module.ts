import { forwardRef, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Module({
    imports: [],
    providers: [SocketGateway],
    exports: [SocketGateway]
})
export class SocketGatewayModule {}
