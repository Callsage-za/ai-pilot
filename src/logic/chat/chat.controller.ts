import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {

    constructor(private readonly chatService: ChatService) {}

    @Post()
    async chat(@Request() req: { user: User }, @Body() body: {
        query: string,
        conversationId: string,
        fileNames: string[],

    }) {
        return this.chatService.ask(body, req.user);
    }

    @Get('get-all-conversations')
    async getAllConversations(@Request() req: { user: User }) {
        return this.chatService.getAllConversations(req.user);
    }

    @Get('get-conversation-messages')
    async getConversationMessages(@Request() req: { user: User }, @Query() query: {
        conversationId: string,
    }) {
        return this.chatService.getConversationMessages(query.conversationId, req.user);
    }   
}
