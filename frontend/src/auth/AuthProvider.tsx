import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loginRequest,
  logoutRequest,
  registerRequest,
  type LoginPayload,
  type RegisterPayload,
} from '../api/auth';
import { refreshAccessToken, setAccessToken, subscribeSessionRefresh } from '../api/client';
import { getMe } from '../api/users';
import type { AuthUser } from './authTypes';
import { AuthContext, type AuthContextValue } from './AuthContext';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applyAuthenticatedUser = useCallback(async (fallback: AuthUser) => {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
    } catch {
      setUser(fallback);
    }
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    const session = await refreshAccessToken();
    await applyAuthenticatedUser(session.user);
  }, [applyAuthenticatedUser]);

  useEffect(() => {
    const unsubscribe = subscribeSessionRefresh((session) => {
      if (!session) {
        clearSession();
        return;
      }

      setAccessToken(session.accessToken);
      setUser(session.user);
      setStatus('authenticated');
    });

    refresh().catch(() => {
      clearSession();
    });

    return unsubscribe;
  }, [clearSession, refresh]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await loginRequest(payload);
      await applyAuthenticatedUser(session.user);
    },
    [applyAuthenticatedUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await registerRequest(payload);
      await login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const syncUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      refresh,
      syncUser,
    }),
    [login, logout, refresh, register, status, syncUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
