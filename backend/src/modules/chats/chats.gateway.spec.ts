/* eslint-disable @typescript-eslint/unbound-method */

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';

type GatewaySocket = Parameters<ChatsGateway['handleJoin']>[0];

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'buyer@example.com',
  role: Role.USER,
  status: UserStatus.ACTIVE,
};

const chatId = '22222222-2222-4222-8222-222222222222';

const messageResponse = {
  id: '33333333-3333-4333-8333-333333333333',
  chatId,
  sender: {
    id: user.id,
    nickname: 'buyer',
    avatarUrl: null,
    trustScore: 0,
    completedTx: 0,
  },
  content: '안녕하세요',
  imageUrl: null,
  isRead: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
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

function createPrismaMock(): PrismaService {
  return {
    user: {
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

type ChatsGatewayConstructor = new (
  chatsService: ChatsService,
  jwtService: JwtService,
  configService: ConfigService<AppConfig, true>,
  prisma: PrismaService,
) => ChatsGateway;

function createConfigServiceMock(): ConfigService<AppConfig, true> {
  return {
    get: vi.fn(() => 'access-secret'),
  } as unknown as ConfigService<AppConfig, true>;
}

function createSocket(authenticated = true): {
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
    data: authenticated ? { user } : {},
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

describe('ChatsGateway', () => {
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

  it('authenticates a socket connection with the handshake token', async () => {
    const { socket } = createSocket(false);
    socket.handshake.auth.token = 'access-token';
    vi.mocked(jwtService.verifyAsync).mockResolvedValue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user);

    await gateway.handleConnection(socket);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(socket.data.user).toEqual(user);
  });

  it('disconnects a socket connection when the DB user is suspended', async () => {
    const { socket, disconnect } = createSocket(false);
    socket.handshake.auth.token = 'access-token';
    vi.mocked(jwtService.verifyAsync).mockResolvedValue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...user,
      status: UserStatus.SUSPENDED,
    });

    await gateway.handleConnection(socket);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.user).toBeUndefined();
  });

  it('disconnects unauthenticated socket connections', async () => {
    const { socket, disconnect } = createSocket(false);

    await gateway.handleConnection(socket);

    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('verifies chat participation before joining a room', async () => {
    const { socket, join } = createSocket();
    vi.mocked(chatsService.assertChatParticipant).mockResolvedValue({
      id: chatId,
      product: {
        id: 'product-1',
        title: '아이폰',
        price: 300000,
        status: 'ON_SALE',
        thumbnailUrl: null,
      },
      buyer: messageResponse.sender,
      seller: messageResponse.sender,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await gateway.handleJoin(socket, { chatId });

    expect(chatsService.assertChatParticipant).toHaveBeenCalledWith(
      chatId,
      user.id,
    );
    expect(join).toHaveBeenCalledWith(`chat:${chatId}`);
    expect(result).toEqual({ event: 'joined', data: { chatId } });
  });

  it('verifies chat participation through service before sending a message', async () => {
    const { socket, emit, to } = createSocket();
    vi.mocked(chatsService.sendMessage).mockResolvedValue(messageResponse);

    const result = await gateway.handleMessage(socket, {
      chatId,
      content: '안녕하세요',
    });

    expect(chatsService.sendMessage).toHaveBeenCalledWith(chatId, user.id, {
      content: '안녕하세요',
      imageUrl: undefined,
    });
    expect(to).toHaveBeenCalledWith(`chat:${chatId}`);
    expect(emit).toHaveBeenCalledWith('message', messageResponse);
    expect(result).toEqual({ event: 'message', data: messageResponse });
  });

  it('marks reads through the participant-checked service method', async () => {
    const { socket, emit, to } = createSocket();
    vi.mocked(chatsService.markRead).mockResolvedValue({ updatedCount: 2 });

    const result = await gateway.handleRead(socket, { chatId });

    expect(chatsService.markRead).toHaveBeenCalledWith(chatId, user.id);
    expect(to).toHaveBeenCalledWith(`chat:${chatId}`);
    expect(emit).toHaveBeenCalledWith('read', {
      chatId,
      userId: user.id,
      updatedCount: 2,
    });
    expect(result).toEqual({
      event: 'read',
      data: { chatId, userId: user.id, updatedCount: 2 },
    });
  });
});
