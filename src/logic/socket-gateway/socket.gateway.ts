import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject, Injectable, UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:4001', 
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:5173',
      'https://callsage.balanceapp.co.za'
    ],
    credentials: false,
  },
})

@Injectable()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private connectedUsers: Map<string, Socket> = new Map(); // userId -> socket
  private connectedUserAuthTokens: Map<string, string> = new Map(); // userId -> authToken
  @WebSocketServer()
  public server: Server;
  
  constructor(
  ) {

  }
  handleDisconnect(client: any) {

  }

  async handleConnection(client: Socket) {
    // console.log(client);
    
    try {

    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }
  emitToSocket(socketId: string, event: string, data: any): boolean {
    const socket = this.server.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
  emitMessage(data:any){
    this.server.emit('data-received',data)
  }

  emitToUser(userId: number, event: string, data: any): boolean {
    const socket = this.connectedUsers.get(userId.toString());
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }
  
}   