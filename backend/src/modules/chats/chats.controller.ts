import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ChatMessageResponse,
  ChatResponse,
  PaginatedChatMessagesResponse,
  PaginatedChatsResponse,
} from './dto/chat-response.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { ListChatMessagesDto } from './dto/list-chat-messages.dto';
import { ListChatsDto } from './dto/list-chats.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(
    @Inject(ChatsService)
    private readonly chatsService: ChatsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  createChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChatDto,
  ): Promise<ChatResponse> {
    return this.chatsService.createChat(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listChats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListChatsDto,
  ): Promise<PaginatedChatsResponse> {
    return this.chatsService.listChats(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getChat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatResponse> {
    return this.chatsService.getChat(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListChatMessagesDto,
  ): Promise<PaginatedChatMessagesResponse> {
    return this.chatsService.listMessages(id, user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageResponse> {
    return this.chatsService.sendMessage(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updatedCount: number }> {
    return this.chatsService.markRead(id, user.id);
  }
}
