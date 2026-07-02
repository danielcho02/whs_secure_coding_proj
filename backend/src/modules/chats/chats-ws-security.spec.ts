/* eslint-disable @typescript-eslint/unbound-method */

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';

type GatewaySocket = Parameters<ChatsGateway['handleConnection']>[0];

type ChatsGatewayConstructor = new (
  chatsService: ChatsService,
  jwtService: JwtService,
  configService: ConfigService<AppConfig, true>,
  prisma: PrismaService,
) => ChatsGateway;

const buyer = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'buyer@example.com',
  role: Role.USER,
  status: UserStatus.ACTIVE,
};

const attacker = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'attacker@example.com',
  role: Role.USER,
  status: UserStatus.ACTIVE,
};

const chatId = '44444444-4444-4444-8444-444444444444';

const publicBuyer = {
  id: buyer.id,
  nickname: 'buyer',
  avatarUrl: null,
  trustScore: 1,
  completedTx: 0,
};

const messageResponse = {
  id: '66666666-6666-4666-8666-666666666666',
  chatId,
  sender: publicBuyer,
  content: '안녕하세요',
  imageUrl: null,
  isRead: false,
  createdAt: new Date('2026-07-01T00:01:00.000Z'),
};

function createChatsServiceMock(): ChatsService {
  return {
    assertChatParticipant: vi.fn(),
    sendMessage: vi.fn(),
    markRead: vi.fn(),
  } as unknown as ChatsService;
}

function createJwtServiceMock(): JwtService {
  return {
    verifyAsync: vi.fn(),
  } as unknown as JwtService;
}

function createConfigServiceMock(): ConfigService<AppConfig, true> {
  return {
    get: vi.fn(() => 'access-secret'),
  } as unknown as ConfigService<AppConfig, true>;
}

function createPrismaMock(): PrismaService {
  return {
    user: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

function createSocket(authenticatedUser?: typeof buyer): {
  socket: GatewaySocket;
  disconnect: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
} {
  const emit = vi.fn();
  const join = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const disconnect = vi.fn();
  const socket = {
    data: authenticatedUser ? { user: authenticatedUser } : {},
    handshake: {
      auth: {},
      headers: {},
    },
    disconnect,
    join,
    to,
  };

  return {
    socket: socket as unknown as GatewaySocket,
    disconnect,
    emit,
    join,
    to,
  };
}

describe('Chat WebSocket security evidence', () => {
  let chatsService: ChatsService;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let gateway: ChatsGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    chatsService = createChatsServiceMock();
    jwtService = createJwtServiceMock();
    prisma = createPrismaMock();
    gateway = new (ChatsGateway as unknown as ChatsGatewayConstructor)(
      chatsService,
      jwtService,
      createConfigServiceMock(),
      prisma,
    );
  });

  it('Chat WS authentication: rejects handshakes without a token', async () => {
    const { socket, disconnect } = createSocket(undefined);

    await gateway.handleConnection(socket);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(socket.data.user).toBeUndefined();
  });

  it('Chat WS authentication: rejects handshakes with an invalid JWT', async () => {
    const { socket, disconnect } = createSocket(undefined);
    socket.handshake.auth.token = 'invalid-access-token';
    vi.mocked(jwtService.verifyAsync).mockRejectedValue(
      new Error('invalid token'),
    );

    await gateway.handleConnection(socket);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'invalid-access-token',
      { secret: 'access-secret' },
    );
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(socket.data.user).toBeUndefined();
  });

  it('Chat WS authentication: trusts JWT subject instead of handshake userId injection', async () => {
    const { socket, disconnect } = createSocket(undefined);
    socket.handshake.auth.token = 'valid-access-token';
    socket.handshake.auth.userId = attacker.id;
    vi.mocked(jwtService.verifyAsync).mockResolvedValue({
      sub: buyer.id,
      role: Role.ADMIN,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buyer);

    await gateway.handleConnection(socket);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: buyer.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });
    expect(disconnect).not.toHaveBeenCalled();
    expect(socket.data.user).toEqual(buyer);
  });

  it('Chat WS BOLA: rejects non-participant join attempts without joining the room', async () => {
    const { socket, join } = createSocket(attacker);
    vi.mocked(chatsService.assertChatParticipant).mockRejectedValue(
      new ForbiddenException('Access denied'),
    );

    await expect(gateway.handleJoin(socket, { chatId })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(chatsService.assertChatParticipant).toHaveBeenCalledWith(
      chatId,
      attacker.id,
    );
    expect(join).not.toHaveBeenCalled();
  });

  it('Chat WS BOLA: rejects non-participant messages without broadcasting', async () => {
    const { socket, to, emit } = createSocket(attacker);
    vi.mocked(chatsService.sendMessage).mockRejectedValue(
      new ForbiddenException('Access denied'),
    );

    await expect(
      gateway.handleMessage(socket, { chatId, content: '침입 메시지' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(chatsService.sendMessage).toHaveBeenCalledWith(chatId, attacker.id, {
      content: '침입 메시지',
      imageUrl: undefined,
    });
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('Chat WS mass assignment: rejects authority-bearing message payload fields', async () => {
    const { socket, to } = createSocket(buyer);

    await expect(
      gateway.handleMessage(socket, {
        chatId,
        content: '권한 주입',
        senderId: attacker.id,
        userId: attacker.id,
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(WsException);

    expect(chatsService.sendMessage).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
  });

  it('Chat WS message send: uses authenticated sender and broadcasts only the service result', async () => {
    const { socket, emit, to } = createSocket(buyer);
    vi.mocked(chatsService.sendMessage).mockResolvedValue(messageResponse);

    const result = await gateway.handleMessage(socket, {
      chatId,
      content: '안녕하세요',
    });

    expect(chatsService.sendMessage).toHaveBeenCalledWith(chatId, buyer.id, {
      content: '안녕하세요',
      imageUrl: undefined,
    });
    expect(to).toHaveBeenCalledWith(`chat:${chatId}`);
    expect(emit).toHaveBeenCalledWith('message', messageResponse);
    expect(result).toEqual({ event: 'message', data: messageResponse });
  });

  it('Chat WS Stored XSS: keeps script payloads as string message content', async () => {
    const xssPayload = '<img src=x onerror=alert(1)>';
    const { socket, emit } = createSocket(buyer);
    const xssMessage = {
      ...messageResponse,
      content: xssPayload,
    };
    vi.mocked(chatsService.sendMessage).mockResolvedValue(xssMessage);

    const result = await gateway.handleMessage(socket, {
      chatId,
      content: xssPayload,
    });

    expect(chatsService.sendMessage).toHaveBeenCalledWith(chatId, buyer.id, {
      content: xssPayload,
      imageUrl: undefined,
    });
    expect(emit).toHaveBeenCalledWith('message', xssMessage);
    expect(result.data.content).toBe(xssPayload);
    expect(result.data).not.toHaveProperty('html');
    expect(result.data).not.toHaveProperty('dangerouslySetInnerHTML');
  });
});
