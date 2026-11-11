// Who is logged in. The access token is kept in sessionStorage (cleared when the tab closes).
// When the API rejects the token (401: expired after 15 min), the user is logged out and
// sent to the login page with a "session expired" message.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../api/client';
import { api } from '../api/endpoints';
import type { User } from '../api/types';

interface Session {
  token: string;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'hotel-booking-session';
const AuthContext = createContext<AuthState | null>(null);

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const navigate = useNavigate();

  const save = (value: Session | null) => {
    setSession(value);
    try {
      if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable: the session simply lives in memory
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    save({ token: result.accessToken, user: result.user });
  }, []);

  const logout = useCallback(() => save(null), []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      save(null);
      navigate('/login?expired=1');
    });
  }, [navigate]);

  const value = useMemo<AuthState>(
    () => ({
      token: session?.token ?? null,
      user: session?.user ?? null,
      isAdmin: session?.user.role === 'ADMIN',
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
