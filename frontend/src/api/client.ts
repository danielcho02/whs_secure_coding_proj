import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthSession } from '../auth/authTypes';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const WS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Access tokens must stay in memory, not localStorage, to reduce stored-XSS
// token theft impact. Refresh tokens belong in HttpOnly Secure SameSite cookies.
let accessToken: string | null = null;
let refreshPromise: Promise<AuthSession> | null = null;
let sessionListener: ((session: AuthSession | null) => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function subscribeSessionRefresh(
  listener: (session: AuthSession | null) => void,
): () => void {
  sessionListener = listener;
  return () => {
    if (sessionListener === listener) {
      sessionListener = null;
    }
  };
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRequest(originalRequest.url)
    ) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      const session = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      sessionListener?.(null);
      throw refreshError;
    }
  },
);

export async function refreshAccessToken(): Promise<AuthSession> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiSuccess<AuthSession>>('/auth/refresh', {})
      .then((response) => {
        const session = response.data.data;
        setAccessToken(session.accessToken);
        sessionListener?.(session);
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function isAuthRequest(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
}
