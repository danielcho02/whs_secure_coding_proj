import { Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Socket } from 'socket.io';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AppConfig } from '../../config/configuration';
import {
  JoinChatEventDto,
  ReadChatEventDto,
  SendChatEventDto,
} from './dto/chat-events.dto';
import { ChatMessageResponse } from './dto/chat-response.dto';
import { ChatsService } from './chats.service';

interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
}

interface AuthenticatedSocketData {
  user?: AuthenticatedUser;
}

type ChatSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  AuthenticatedSocketData
>;

const WEBSOCKET_CORS_ORIGIN =
  process.env.CORS_ORIGIN ?? 'http://localhost:5173';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: WEBSOCKET_CORS_ORIGIN,
    credentials: true,
  },
})
export class ChatsGateway implements OnGatewayConnection {
  private readonly accessSecret: string;

  constructor(
    @Inject(ChatsService)
    private readonly chatsService: ChatsService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    configService: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = configService.get('auth.jwtAccessSecret', {
      infer: true,
    });
  }

  async handleConnection(client: ChatSocket): Promise<void> {
    try {
      client.data.user = await this.verifyClient(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<{ event: 'joined'; data: { chatId: string } }> {
    const user = this.requireUser(client);
    const dto = await this.validatePayload(JoinChatEventDto, payload);

    await this.chatsService.assertChatParticipant(dto.chatId, user.id);
    await client.join(this.chatRoom(dto.chatId));

    return {
      event: 'joined',
      data: { chatId: dto.chatId },
    };
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<{ event: 'message'; data: ChatMessageResponse }> {
    const user = this.requireUser(client);
    const dto = await this.validatePayload(SendChatEventDto, payload);
    const message = await this.chatsService.sendMessage(dto.chatId, user.id, {
      content: dto.content,
      imageUrl: dto.imageUrl,
    });

    client.to(this.chatRoom(dto.chatId)).emit('message', message);

    return {
      event: 'message',
      data: message,
    };
  }

  @SubscribeMessage('read')
  async handleRead(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<{
    event: 'read';
    data: { chatId: string; userId: string; updatedCount: number };
  }> {
    const user = this.requireUser(client);
    const dto = await this.validatePayload(ReadChatEventDto, payload);
    const result = await this.chatsService.markRead(dto.chatId, user.id);

    client.to(this.chatRoom(dto.chatId)).emit('read', {
      chatId: dto.chatId,
      userId: user.id,
      updatedCount: result.updatedCount,
    });

    return {
      event: 'read',
      data: {
        chatId: dto.chatId,
        userId: user.id,
        updatedCount: result.updatedCount,
      },
    };
  }

  private async verifyClient(client: ChatSocket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
      token,
      { secret: this.accessSecret },
    );

    if (!this.isAccessPayload(payload)) {
      throw new UnauthorizedException('Authentication is required');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }

  private extractToken(client: ChatSocket): string | undefined {
    return (
      this.extractTokenFromAuth(client.handshake.auth) ??
      this.extractBearerToken(client.handshake.headers.authorization)
    );
  }

  private extractTokenFromAuth(auth: unknown): string | undefined {
    if (typeof auth !== 'object' || auth === null || !('token' in auth)) {
      return undefined;
    }

    const token = (auth as { token?: unknown }).token;

    if (typeof token !== 'string') {
      return undefined;
    }

    const trimmed = token.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private extractBearerToken(authorization: unknown): string | undefined {
    const header = Array.isArray(authorization)
      ? authorization.find(
          (value): value is string => typeof value === 'string',
        )
      : authorization;

    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return undefined;
    }

    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : undefined;
  }

  private requireUser(client: ChatSocket): AuthenticatedUser {
    if (!client.data.user) {
      throw new WsException('Authentication is required');
    }

    return client.data.user;
  }

  private async validatePayload<T extends object>(
    metatype: new () => T,
    payload: unknown,
  ): Promise<T> {
    const dto = plainToInstance(metatype, payload);

    try {
      await validateOrReject(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch {
      throw new WsException('Invalid payload');
    }

    return dto;
  }

  private chatRoom(chatId: string): string {
    return `chat:${chatId}`;
  }

  private isAccessPayload(payload: unknown): payload is AccessPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      'email' in payload &&
      'role' in payload &&
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      this.isRole(payload.role)
    );
  }

  private isRole(role: unknown): role is Role {
    return role === Role.USER || role === Role.ADMIN;
  }
}
