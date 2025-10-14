import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:4001',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:5173',
      'https://callsage.balanceapp.co.za',
    ],
    credentials: false,
  },
})
@Injectable()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly connectedUsers: Map<string, Socket> = new Map(); // userId -> socket
  private readonly connectedUserAuthTokens: Map<string, string> = new Map(); // userId -> authToken

  @WebSocketServer()
  public server: Server;

  handleDisconnect(client: Socket) {
    const userKey: string | undefined = client.data?.userKey;

    if (userKey && this.connectedUsers.get(userKey)?.id === client.id) {
      this.connectedUsers.delete(userKey);
      this.connectedUserAuthTokens.delete(userKey);
      return;
    }

    // Fallback in case userKey was never set
    for (const [storedKey, socket] of this.connectedUsers.entries()) {
      if (socket.id === client.id) {
        this.connectedUsers.delete(storedKey);
        this.connectedUserAuthTokens.delete(storedKey);
        break;
      }
    }
  }

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth ?? {};
    const query = client.handshake.query ?? {};

    const userId = this.parseString(auth.userId ?? query.userId);
    const authToken = this.parseString(auth.token ?? query.token);
    const userKey = userId || client.id;

    client.data.userKey = userKey;
    this.connectedUsers.set(userKey, client);

    if (authToken) {
      this.connectedUserAuthTokens.set(userKey, authToken);
    }

    client.emit('connection:ack', {
      socketId: client.id,
      userKey,
      isAuthenticated: Boolean(authToken),
    });
  }

  emitToSocket(socketId: string, event: string, data: any): boolean {
    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      return false;
    }
    socket.emit(event, data);
    return true;
  }

  emitToUser(userId: number | string, event: string, data: any): boolean {
    const socket = this.connectedUsers.get(userId.toString());
    if (!socket) {
      return false;
    }
    socket.emit(event, data);
    return true;
  }

  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }

  emitMessage(data: any) {
    this.broadcast('data-received', data);
  }

  private parseString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  }
}
