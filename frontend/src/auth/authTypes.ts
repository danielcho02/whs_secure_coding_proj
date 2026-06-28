export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'WITHDRAWN';

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  bio?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  trustScore?: number;
  completedTx?: number;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}
