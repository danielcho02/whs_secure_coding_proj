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
