export interface PublicBlockedUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface BlockResponse {
  id: string;
  blockerId: string;
  blockedId: string;
  blocked: PublicBlockedUser;
}

export interface DeleteBlockResponse {
  deleted: boolean;
}

export interface PaginatedBlocksResponse {
  items: BlockResponse[];
  page: number;
  limit: number;
  total: number;
}
