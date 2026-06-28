import { apiClient, setAccessToken } from './client';
import type { AuthSession, AuthUser } from '../auth/authTypes';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  nickname: string;
}

export async function loginRequest(payload: LoginPayload): Promise<AuthSession> {
  const response = await apiClient.post<ApiSuccess<AuthSession>>(
    '/auth/login',
    payload,
  );
  setAccessToken(response.data.data.accessToken);
  return response.data.data;
}

export async function registerRequest(
  payload: RegisterPayload,
): Promise<AuthUser> {
  const response = await apiClient.post<ApiSuccess<AuthUser>>(
    '/auth/register',
    payload,
  );
  return response.data.data;
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post<ApiSuccess<{ loggedOut: true }>>('/auth/logout', {});
  setAccessToken(null);
}
