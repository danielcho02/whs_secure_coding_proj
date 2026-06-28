/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ChatsService } from './chats.service';

function createPrismaMock(): PrismaService {
  return {
    product: {
      findFirst: vi.fn(),
    },
    chat: {
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    block: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  } as unknown as PrismaService;
}

const buyer = {
  id: 'buyer-1',
  nickname: 'buyer',
  avatarUrl: null,
  trustScore: 5,
  completedTx: 1,
};

const seller = {
  id: 'seller-1',
  nickname: 'seller',
  avatarUrl: null,
  trustScore: 20,
  completedTx: 4,
};

const productSummary = {
  id: 'product-1',
  title: '아이폰 15',
  price: 300000,
  status: ProductStatus.ON_SALE,
  thumbnailUrl: 'products/phone.jpg',
};

const productForChat = {
  id: 'product-1',
  sellerId: seller.id,
  isHidden: false,
  status: ProductStatus.ON_SALE,
};

const chatResponse = {
  id: 'chat-1',
  productId: productSummary.id,
  buyerId: buyer.id,
  sellerId: seller.id,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  product: {
    id: productSummary.id,
    title: productSummary.title,
    price: productSummary.price,
    status: productSummary.status,
    images: [{ url: productSummary.thumbnailUrl, order: 0 }],
  },
  buyer,
  seller,
};

const messageResponse = {
  id: 'message-1',
  chatId: chatResponse.id,
  senderId: buyer.id,
  content: '안녕하세요',
  imageUrl: null,
  isRead: false,
  createdAt: new Date('2026-01-01T00:01:00.000Z'),
  sender: buyer,
};

describe('ChatsService', () => {
  let prisma: PrismaService;
  let service: ChatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(prisma.block.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.ACTIVE,
    });
    service = new ChatsService(prisma);
  });

  it('creates a chat using the authenticated user as buyer and product seller as seller', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(productForChat);
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.chat.create).mockResolvedValue(chatResponse);

    const result = await service.createChat(buyer.id, {
      productId: productForChat.id,
    });

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productForChat.id, isHidden: false },
      }),
    );
    expect(prisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          productId: productForChat.id,
          buyerId: buyer.id,
          sellerId: seller.id,
        },
      }),
    );
    expect(result.buyer).toEqual(buyer);
    expect(result.seller).toEqual(seller);
  });

  it('rejects creating a chat for the authenticated user own product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      ...productForChat,
      sellerId: buyer.id,
    });

    await expect(
      service.createChat(buyer.id, { productId: productForChat.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });

  it('rejects creating a chat when either side has blocked the other', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(productForChat);
    vi.mocked(prisma.block.findFirst).mockResolvedValue({
      id: 'block-1',
      blockerId: seller.id,
      blockedId: buyer.id,
    });

    await expect(
      service.createChat(buyer.id, { productId: productForChat.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });

  it('rejects creating a chat by a suspended user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.createChat(buyer.id, { productId: productForChat.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });

  it('rejects creating a chat for a hidden or missing product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(
      service.createChat(buyer.id, { productId: productForChat.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.chat.create).not.toHaveBeenCalled();
  });

  it('reuses an existing chat for the same product and buyer', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(productForChat);
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    const result = await service.createChat(buyer.id, {
      productId: productForChat.id,
    });

    expect(prisma.chat.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId_buyerId: {
            productId: productForChat.id,
            buyerId: buyer.id,
          },
        },
      }),
    );
    expect(prisma.chat.create).not.toHaveBeenCalled();
    expect(result.id).toBe(chatResponse.id);
  });

  it('lists only chats where the current user participates', async () => {
    vi.mocked(prisma.chat.findMany).mockResolvedValue([
      {
        ...chatResponse,
        messages: [messageResponse],
        _count: { messages: 2 },
      },
    ]);
    vi.mocked(prisma.chat.count).mockResolvedValue(1);

    const result = await service.listChats(buyer.id, { page: 1, limit: 20 });

    expect(prisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ buyerId: buyer.id }, { sellerId: buyer.id }],
        },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].counterpart).toEqual(seller);
    expect(result.items[0].unreadCount).toBe(2);
  });

  it('blocks other users from reading chat detail', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    await expect(
      service.getChat('chat-1', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns chat detail for a participant', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    const result = await service.getChat('chat-1', buyer.id);

    expect(result.id).toBe('chat-1');
    expect(result.product).toEqual(productSummary);
  });

  it('lists messages only after participant verification', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([messageResponse]);
    vi.mocked(prisma.chatMessage.count).mockResolvedValue(1);

    const result = await service.listMessages('chat-1', buyer.id, {
      page: 1,
      limit: 20,
    });

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: 'chat-1' },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(result.items[0].sender).toEqual(buyer);
  });

  it('blocks other users from listing messages', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    await expect(
      service.listMessages('chat-1', 'other-user', { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
  });

  it('sends a message as the authenticated participant only', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(messageResponse);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notice-1' });

    const result = await service.sendMessage('chat-1', buyer.id, {
      content: '안녕하세요',
    });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          chatId: 'chat-1',
          senderId: buyer.id,
          content: '안녕하세요',
          imageUrl: undefined,
        },
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: seller.id,
          type: 'CHAT',
        }),
      }),
    );
    expect(result.content).toBe('안녕하세요');
  });

  it('rejects sending a message when either participant has blocked the other', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.block.findFirst).mockResolvedValue({
      id: 'block-1',
      blockerId: seller.id,
      blockedId: buyer.id,
    });

    await expect(
      service.sendMessage('chat-1', buyer.id, { content: '안녕하세요' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('rejects sending a message by a suspended user', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: buyer.id,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.sendMessage('chat-1', buyer.id, { content: '안녕하세요' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('stores XSS payloads as plain string message data without render structure', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      ...messageResponse,
      content: payload,
    });
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notice-1' });

    const result = await service.sendMessage('chat-1', buyer.id, {
      content: payload,
    });

    expect(result.content).toBe(payload);
    expect(result).not.toHaveProperty('html');
    expect(result).not.toHaveProperty('dangerouslySetInnerHTML');
  });

  it('blocks other users from sending messages to a chat', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    await expect(
      service.sendMessage('chat-1', 'other-user', { content: '침입' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('marks only counterpart messages as read', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);
    vi.mocked(prisma.chatMessage.updateMany).mockResolvedValue({ count: 3 });

    const result = await service.markRead('chat-1', buyer.id);

    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: buyer.id },
        isRead: false,
      },
      data: { isRead: true },
    });
    expect(result).toEqual({ updatedCount: 3 });
  });

  it('blocks other users from marking chat messages as read', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    await expect(
      service.markRead('chat-1', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.updateMany).not.toHaveBeenCalled();
  });

  it('does not select or return passwordHash, email, or phone in chat responses', async () => {
    vi.mocked(prisma.chat.findUnique).mockResolvedValue(chatResponse);

    const result = await service.getChat('chat-1', buyer.id);

    expect(prisma.chat.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          buyer: expect.objectContaining({
            select: expect.not.objectContaining({
              passwordHash: true,
              email: true,
              phone: true,
            }),
          }),
          seller: expect.objectContaining({
            select: expect.not.objectContaining({
              passwordHash: true,
              email: true,
              phone: true,
            }),
          }),
        }),
      }),
    );
    expect(result.buyer).not.toHaveProperty('passwordHash');
    expect(result.buyer).not.toHaveProperty('email');
    expect(result.buyer).not.toHaveProperty('phone');
    expect(result.seller).not.toHaveProperty('passwordHash');
    expect(result.seller).not.toHaveProperty('email');
    expect(result.seller).not.toHaveProperty('phone');
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
