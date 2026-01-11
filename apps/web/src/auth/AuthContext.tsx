import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LoginRequestSchema,
  RefreshRequestSchema,
  type AuthUser,
} from '@taller/shared';
import { getApiBaseUrl, parseApiError } from '../lib/api';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'taller.refreshToken';

function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setStoredRefreshToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      setUser(null);
      setAccessToken(null);
      return null;
    }

    const payload = RefreshRequestSchema.safeParse({ refreshToken });
    if (!payload.success) {
      setStoredRefreshToken(null);
      setUser(null);
      setAccessToken(null);
      return null;
    }

    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.data),
      credentials: 'include',
    });

    if (!response.ok) {
      setStoredRefreshToken(null);
      setUser(null);
      setAccessToken(null);
      return null;
    }

    const data = await response.json();
    setAccessToken(data.accessToken);
    setStoredRefreshToken(data.refreshToken);
    setUser(data.user ?? null);
    return data.accessToken ?? null;
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = LoginRequestSchema.parse({ email, password });
    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await parseApiError(response);
      throw new Error(error.message);
    }

    const data = await response.json();
    setAccessToken(data.accessToken);
    setStoredRefreshToken(data.refreshToken);
    setUser(data.user ?? null);
  }, []);

  const logout = useCallback(() => {
    setStoredRefreshToken(null);
    setAccessToken(null);
    setUser(null);
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

      if (response.status === 401) {
        const newAccessToken = await refresh();
        if (!newAccessToken) {
          throw new Error('Sesión expirada. Ingresa nuevamente.');
        }
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
        if (init?.body && !retryHeaders.has('Content-Type')) {
          retryHeaders.set('Content-Type', 'application/json');
        }

        const retryResponse = await fetch(`${getApiBaseUrl()}${path}`, {
          ...init,
          headers: retryHeaders,
          credentials: 'include',
        });
        if (!retryResponse.ok) {
          const error = await parseApiError(retryResponse);
          throw new Error(error.message);
        }
        if (retryResponse.status === 204) {
          return undefined as T;
        }
        return (await retryResponse.json()) as T;
      }

      if (!response.ok) {
        const error = await parseApiError(response);
        throw new Error(error.message);
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
    [accessToken, refresh],
  );

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, logout, apiFetch }),
    [user, accessToken, isLoading, login, logout, apiFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
