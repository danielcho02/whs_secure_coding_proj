import { apiClient } from "./client";

export type ChatProductStatus = "ON_SALE" | "RESERVED" | "SOLD" | "HIDDEN";

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
  status: ChatProductStatus;
  thumbnailUrl: string | null;
}

export interface Chat {
  id: string;
  product: ChatProductSummary;
  buyer: PublicChatUser;
  seller: PublicChatUser;
  createdAt: string;
}

export interface ChatLastMessage {
  id: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatListItem extends Chat {
  counterpart: PublicChatUser;
  lastMessage: ChatLastMessage | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: PublicChatUser;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatListParams {
  page?: number;
  limit?: number;
}

export type ChatMessageListParams = ChatListParams;

export interface ChatPage {
  items: ChatListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ChatMessagePage {
  items: ChatMessage[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateChatPayload {
  productId: string;
}

export interface SendMessagePayload {
  content: string;
  imageUrl?: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function createChat(payload: CreateChatPayload): Promise<Chat> {
  const response = await apiClient.post<ApiSuccess<Chat>>("/chats", payload);
  return response.data.data;
}

export async function listChats(
  params: ChatListParams = {},
): Promise<ChatPage> {
  const response = await apiClient.get<ApiSuccess<ChatPage>>("/chats", {
    params,
  });
  return response.data.data;
}

export async function getChat(chatId: string): Promise<Chat> {
  const response = await apiClient.get<ApiSuccess<Chat>>(`/chats/${chatId}`);
  return response.data.data;
}

export async function listMessages(
  chatId: string,
  params: ChatMessageListParams = {},
): Promise<ChatMessagePage> {
  const response = await apiClient.get<ApiSuccess<ChatMessagePage>>(
    `/chats/${chatId}/messages`,
    { params },
  );
  return response.data.data;
}

export async function sendMessage(
  chatId: string,
  payload: SendMessagePayload,
): Promise<ChatMessage> {
  const response = await apiClient.post<ApiSuccess<ChatMessage>>(
    `/chats/${chatId}/messages`,
    payload,
  );
  return response.data.data;
}

export async function markChatRead(
  chatId: string,
): Promise<{ updatedCount: number }> {
  const response = await apiClient.post<ApiSuccess<{ updatedCount: number }>>(
    `/chats/${chatId}/read`,
    {},
  );
  return response.data.data;
}
