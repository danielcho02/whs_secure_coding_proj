import { apiClient } from './client';

export interface BlockedUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  blocked: BlockedUser;
}

export interface BlockPage {
  items: Block[];
  page: number;
  limit: number;
  total: number;
}

export interface ListBlocksParams {
  page?: number;
  limit?: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function createBlock(blockedUserId: string): Promise<Block> {
  const response = await apiClient.post<ApiSuccess<Block>>('/blocks', {
    blockedUserId,
  });
  return response.data.data;
}

export async function deleteBlock(
  blockedUserId: string,
): Promise<{ deleted: boolean }> {
  const response = await apiClient.delete<ApiSuccess<{ deleted: boolean }>>(
    `/blocks/${blockedUserId}`,
  );
  return response.data.data;
}

export async function listBlocks(
  params: ListBlocksParams = {},
): Promise<BlockPage> {
  const response = await apiClient.get<ApiSuccess<BlockPage>>('/blocks', {
    params,
  });
  return response.data.data;
}
