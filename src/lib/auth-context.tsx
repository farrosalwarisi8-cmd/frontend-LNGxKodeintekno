"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  authService,
  toSessionUser,
  type SessionUser,
} from "./services/auth.service";
import { getToken, clearToken } from "./api-client";

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  isMedicalRole: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; mfaRequired?: boolean; userId?: string }>;
  verifyMfa: (userId: string, code: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Baca token dari localStorage di task berikutnya (hindari setState sinkron di effect)
    const timer = setTimeout(() => {
      const token = getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const mapped: SessionUser = toSessionUser({
            id: payload.sub,
            username: payload.username,
            email: payload.email,
            roles: payload.roles ?? (payload.role ? [payload.role] : []),
            isMedicalRole: payload.isMedicalRole ?? false,
          });
          if (alive) {
            setUser({
              id: mapped.id,
              username: mapped.username,
              name: mapped.name,
              role: mapped.role,
              isMedicalRole: mapped.isMedicalRole,
            });
          }
        } catch {
          clearToken();
        }
      }
      if (alive) setIsLoading(false);
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await authService.login(username, password);
      if (res.mfaRequired) {
        return { ok: false, mfaRequired: true, userId: res.userId };
      }
      if (res.accessToken && res.user) {
        setUser(toSessionUser(res.user));
        return { ok: true };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }, []);

  const verifyMfa = useCallback(async (userId: string, code: string) => {
    try {
      const res = await authService.verifyMfa(userId, code);
      if (res.accessToken && res.user) {
        setUser(toSessionUser(res.user));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        verifyMfa,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
