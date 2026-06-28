import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatLastMessage,
  ChatMessageResponse,
  ChatProductSummary,
  ChatResponse,
  PaginatedChatMessagesResponse,
  PaginatedChatsResponse,
  PublicChatUser,
} from './dto/chat-response.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { ListChatMessagesDto } from './dto/list-chat-messages.dto';
import { ListChatsDto } from './dto/list-chats.dto';
import { SendMessageDto } from './dto/send-message.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  nickname: true,
  avatarUrl: true,
  trustScore: true,
  completedTx: true,
} satisfies Prisma.UserSelect;

const PRODUCT_FOR_CHAT_SELECT = {
  id: true,
  sellerId: true,
  isHidden: true,
  status: true,
} satisfies Prisma.ProductSelect;

const PRODUCT_SUMMARY_SELECT = {
  id: true,
  title: true,
  price: true,
  status: true,
  images: {
    select: {
      url: true,
      order: true,
    },
    orderBy: { order: 'asc' },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const LAST_MESSAGE_SELECT = {
  id: true,
  senderId: true,
  content: true,
  imageUrl: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.ChatMessageSelect;

const MESSAGE_RESPONSE_SELECT = {
  id: true,
  chatId: true,
  senderId: true,
  content: true,
  imageUrl: true,
  isRead: true,
  createdAt: true,
  sender: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.ChatMessageSelect;

const CHAT_RESPONSE_SELECT = {
  id: true,
  productId: true,
  buyerId: true,
  sellerId: true,
  createdAt: true,
  product: {
    select: PRODUCT_SUMMARY_SELECT,
  },
  buyer: {
    select: PUBLIC_USER_SELECT,
  },
  seller: {
    select: PUBLIC_USER_SELECT,
  },
} satisfies Prisma.ChatSelect;

interface ProductForChat {
  id: string;
  sellerId: string;
  isHidden: boolean;
  status: ProductStatus;
}

interface ProductSummaryRecord {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  images: Array<{
    url: string;
    order: number;
  }>;
}

interface ChatRecord {
  id: string;
  buyerId: string;
  sellerId: string;
  createdAt: Date;
  product: ProductSummaryRecord;
  buyer: PublicChatUser;
  seller: PublicChatUser;
}

interface ChatListRecord extends ChatRecord {
  messages: ChatLastMessage[];
  _count: {
    messages: number;
  };
}

interface MessageRecord {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: Date;
  sender: PublicChatUser;
}

@Injectable()
export class ChatsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createChat(buyerId: string, dto: CreateChatDto): Promise<ChatResponse> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isHidden: false },
      select: PRODUCT_FOR_CHAT_SELECT,
    });

    if (!product || this.isHiddenProduct(product)) {
      throw new NotFoundException('Product not found');
    }

    if (product.sellerId === buyerId) {
      throw new BadRequestException(
        'Cannot create a chat for your own product',
      );
    }

    const existingChat = await this.prisma.chat.findUnique({
      where: {
        productId_buyerId: {
          productId: dto.productId,
          buyerId,
        },
      },
      select: CHAT_RESPONSE_SELECT,
    });

    if (existingChat) {
      return this.toChatResponse(existingChat);
    }

    try {
      const chat = await this.prisma.chat.create({
        data: {
          productId: dto.productId,
          buyerId,
          sellerId: product.sellerId,
        },
        select: CHAT_RESPONSE_SELECT,
      });

      return this.toChatResponse(chat);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const reusedChat = await this.prisma.chat.findUnique({
          where: {
            productId_buyerId: {
              productId: dto.productId,
              buyerId,
            },
          },
          select: CHAT_RESPONSE_SELECT,
        });

        if (reusedChat) {
          return this.toChatResponse(reusedChat);
        }
      }

      throw error;
    }
  }

  async listChats(
    userId: string,
    query: ListChatsDto,
  ): Promise<PaginatedChatsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.chat.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: this.buildChatListSelect(userId),
      }),
      this.prisma.chat.count({ where }),
    ]);

    return {
      items: items.map((chat) => this.toChatListItem(chat, userId)),
      page,
      limit,
      total,
    };
  }

  async getChat(chatId: string, userId: string): Promise<ChatResponse> {
    const chat = await this.findChatOrThrow(chatId);
    this.assertParticipant(chat, userId);
    return this.toChatResponse(chat);
  }

  async assertChatParticipant(
    chatId: string,
    userId: string,
  ): Promise<ChatResponse> {
    return this.getChat(chatId, userId);
  }

  async listMessages(
    chatId: string,
    userId: string,
    query: ListChatMessagesDto,
  ): Promise<PaginatedChatMessagesResponse> {
    await this.assertChatParticipant(chatId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { chatId };

    const [items, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: MESSAGE_RESPONSE_SELECT,
      }),
      this.prisma.chatMessage.count({ where }),
    ]);

    return {
      items: items.map((message) => this.toMessageResponse(message)),
      page,
      limit,
      total,
    };
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageResponse> {
    const chat = await this.findChatOrThrow(chatId);
    this.assertParticipant(chat, senderId);

    // TODO(FR-21): Check Block records here before creating the message.
    const message = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId,
        content: dto.content,
        imageUrl: dto.imageUrl,
      },
      select: MESSAGE_RESPONSE_SELECT,
    });

    await this.createChatNotification(chat, senderId);

    return this.toMessageResponse(message);
  }

  async markRead(
    chatId: string,
    userId: string,
  ): Promise<{ updatedCount: number }> {
    await this.assertChatParticipant(chatId, userId);

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }

  private async findChatOrThrow(chatId: string): Promise<ChatRecord> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: CHAT_RESPONSE_SELECT,
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  private assertParticipant(chat: ChatRecord, userId: string): void {
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private buildChatListSelect(userId: string) {
    return {
      ...CHAT_RESPONSE_SELECT,
      messages: {
        select: LAST_MESSAGE_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: {
              isRead: false,
              senderId: { not: userId },
            },
          },
        },
      },
    } satisfies Prisma.ChatSelect;
  }

  private toChatResponse(chat: ChatRecord): ChatResponse {
    return {
      id: chat.id,
      product: this.toProductSummary(chat.product),
      buyer: chat.buyer,
      seller: chat.seller,
      createdAt: chat.createdAt,
    };
  }

  private toChatListItem(
    chat: ChatListRecord,
    userId: string,
  ): PaginatedChatsResponse['items'][number] {
    return {
      ...this.toChatResponse(chat),
      counterpart: chat.buyerId === userId ? chat.seller : chat.buyer,
      lastMessage: chat.messages[0] ?? null,
      unreadCount: chat._count.messages,
    };
  }

  private toProductSummary(product: ProductSummaryRecord): ChatProductSummary {
    return {
      id: product.id,
      title: product.title,
      price: product.price,
      status: product.status,
      thumbnailUrl: product.images[0]?.url ?? null,
    };
  }

  private toMessageResponse(message: MessageRecord): ChatMessageResponse {
    return {
      id: message.id,
      chatId: message.chatId,
      sender: message.sender,
      content: message.content,
      imageUrl: message.imageUrl,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }

  private async createChatNotification(
    chat: ChatRecord,
    senderId: string,
  ): Promise<void> {
    const recipientId =
      chat.buyerId === senderId ? chat.sellerId : chat.buyerId;

    await this.prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'CHAT',
        message: '새 채팅 메시지가 도착했습니다.',
      },
      select: { id: true },
    });
  }

  private isHiddenProduct(product: ProductForChat): boolean {
    return product.isHidden || product.status === ProductStatus.HIDDEN;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
