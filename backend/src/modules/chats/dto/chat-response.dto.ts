import { ProductStatus } from '@prisma/client';

export interface PublicChatUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface ChatProductSummary {
  id: string;
  title: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
}

export interface ChatResponse {
  id: string;
  product: ChatProductSummary;
  buyer: PublicChatUser;
  seller: PublicChatUser;
  createdAt: Date;
}

export interface ChatLastMessage {
  id: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface ChatListItemResponse extends ChatResponse {
  counterpart: PublicChatUser;
  lastMessage: ChatLastMessage | null;
  unreadCount: number;
}

export interface PaginatedChatsResponse {
  items: ChatListItemResponse[];
  page: number;
  limit: number;
  total: number;
}

export interface ChatMessageResponse {
  id: string;
  chatId: string;
  sender: PublicChatUser;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface PaginatedChatMessagesResponse {
  items: ChatMessageResponse[];
  page: number;
  limit: number;
  total: number;
}
