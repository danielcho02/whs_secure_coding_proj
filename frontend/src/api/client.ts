import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

// Access tokens must stay in memory, not localStorage, to reduce stored-XSS
// token theft impact. Refresh tokens belong in HttpOnly Secure SameSite cookies.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});
