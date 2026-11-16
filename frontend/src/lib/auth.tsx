import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, setSessionLostHandler, tryRefresh } from './api';

export interface User {
  id: string; email: string; fullName: string; roles: string[]; permissions?: string[]; emailVerified: boolean; verifiedBadge: boolean;
  promoCreditsPaise: number; profile: any; advertiserProfile: any; promoterProfile: any;
}
interface AuthState {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Record<string, unknown>) => Promise<{ user: User; devVerificationToken?: string }>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  hasRole: (role: string) => boolean;
  can: (permission: string) => boolean;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const reload = useCallback(async () => { setUser(await api<User>('/me')); }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    // Restore the session from the HttpOnly refresh cookie, if one exists.
    (async () => {
      try { if (await tryRefresh()) setUser(await api<User>('/me')); } catch { /* signed out */ } finally { setLoading(false); }
    })();
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, reload,
    login: async (email, password) => {
      const res = await api<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      setAccessToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    register: async (body) => {
      const res = await api<{ accessToken: string; user: User; devVerificationToken?: string }>('/auth/register', { method: 'POST', body });
      setAccessToken(res.accessToken);
      setUser(res.user);
      return res;
    },
    logout: async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
      setAccessToken(null);
      setUser(null);
      qc.clear();
    },
    hasRole: (role) => !!user?.roles.includes(role),
    can: (permission) => !!user?.permissions?.includes(permission),
  }), [user, loading, reload, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
export const isStaff = (u: User | null) => !!u && (u.roles.includes('ADMIN') || u.roles.includes('SUPER_ADMIN'));
