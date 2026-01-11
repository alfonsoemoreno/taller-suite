/* eslint-disable react-refresh/only-export-components */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { SessionProvider, signIn, signOut, useSession } from 'next-auth/react';
import type { AuthUser } from '@/shared';
import { getApiBaseUrl, parseApiError } from '../lib/api';

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
  const { data, status } = useSession();

  const user = useMemo<AuthUser | null>(() => {
    if (!data?.user) {
      return null;
    }

    const { id, email, role, tenantId } = data.user;
    if (!id || !email) {
      return null;
    }

    return {
      id,
      email,
      role: role ?? 'OWNER',
      tenantId: tenantId ?? '',
    } satisfies AuthUser;
  }, [data?.user]);

  const login = useCallback(async () => {
    await signIn('neon', { callbackUrl: '/app' });
  }, []);

  const logout = useCallback(() => {
    void signOut({ callbackUrl: '/login' });
  }, []);

  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);
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
    [],
  );

  const value = useMemo(
    () => ({
      user,
      accessToken: null,
      isLoading: status === 'loading',
      login,
      logout,
      apiFetch,
    }),
    [user, status, login, logout, apiFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
