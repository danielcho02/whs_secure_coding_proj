import { apiClient } from './client';
import type { AuthUser } from '../auth/authTypes';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<ApiSuccess<AuthUser>>('/users/me');
  return response.data.data;
}

export interface UpdateMePayload {
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface PublicUserProfile {
  id: string;
  nickname: string;
  bio?: string | null;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
  createdAt?: string;
}

export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  const response = await apiClient.patch<ApiSuccess<AuthUser>>('/users/me', payload);
  return response.data.data;
}

export async function getPublicProfile(userId: string): Promise<PublicUserProfile> {
  const response = await apiClient.get<ApiSuccess<PublicUserProfile>>(
    `/users/${userId}`,
  );
  return response.data.data;
}
