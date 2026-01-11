/* eslint-disable react-refresh/only-export-components */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@/shared';
import { getApiBaseUrl, parseApiError } from '../lib/api';
import { authClient } from '../lib/neon-auth';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = authClient as unknown as {
        getSession?: () => Promise<unknown>;
        session?: () => Promise<unknown>;
      };
      const sessionResponse =
        (await client.getSession?.()) ?? (await client.session?.());
      const wrapped = sessionResponse as
        | { data?: { session?: { access_token?: string } } }
        | { session?: { access_token?: string } }
        | undefined;
      let token =
        wrapped?.data?.session?.access_token ??
        wrapped?.session?.access_token ??
        null;
      if (!token) {
        const baseUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? '';
        if (baseUrl) {
          const resp = await fetch(`${baseUrl}/token`, {
            credentials: 'include',
          });
          if (resp.ok) {
            const data = (await resp.json()) as
              | { data?: { access_token?: string } }
              | { access_token?: string };
            token = data?.data?.access_token ?? data?.access_token ?? null;
          }
        }
      }
      setAccessToken(token);
      if (!token) {
        setUser(null);
        return;
      }
      const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        return;
      }
      const email = data?.email;
      if (email) {
        setUser({
          id: data.id ?? email,
          email,
          role: data.role ?? 'OWNER',
          tenantId: data.tenantId ?? '',
        });
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void resolveSession();
  }, [resolveSession]);

  const login = useCallback(async () => {
    window.location.href = '/auth/sign-in';
  }, []);

  const logout = useCallback(() => {
    void (authClient as unknown as { signOut?: () => Promise<void> }).signOut?.();
    setAccessToken(null);
    setUser(null);
    window.location.href = '/auth/sign-in';
  }, []);

  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        throw new Error(error.message);
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
    [accessToken],
  );

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      logout,
      apiFetch,
    }),
    [user, accessToken, isLoading, login, logout, apiFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContextProvider>{children}</AuthContextProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
