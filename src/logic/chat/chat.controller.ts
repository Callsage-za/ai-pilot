import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {

    constructor(private readonly chatService: ChatService) {}

    @Post()
    async chat(@Body() body: {
        query: string,
        conversationId: string,
        fileNames: string[],

    }) {
        console.log("body", body);
        
        return this.chatService.ask(body);
    }

    @Get('get-all-conversations')
    async getAllConversations() {
        return this.chatService.getAllConversations();
    }

    @Get('get-conversation-messages')
    async getConversationMessages(@Query() query: {
        conversationId: string,
    }) {
        return this.chatService.getConversationMessages(query.conversationId);
    }   
}
