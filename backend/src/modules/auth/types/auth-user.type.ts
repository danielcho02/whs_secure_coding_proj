import { Role, UserStatus } from '@prisma/client';

export interface SafeAuthUser {
  id: string;
  email: string;
  nickname: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresInSeconds: number;
  user: SafeAuthUser;
}

export interface PublicAuthResult {
  accessToken: string;
  user: SafeAuthUser;
}
