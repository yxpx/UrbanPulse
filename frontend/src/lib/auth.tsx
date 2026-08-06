"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface AuthUser {
  username: string;
  role: string;
  access_token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, role: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("urbanpulse_auth_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.access_token) {
          setUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem("urbanpulse_auth_user");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  const login = (username: string, role: string, token: string) => {
    const userData: AuthUser = { username, role, access_token: token };
    localStorage.setItem("urbanpulse_auth_user", JSON.stringify(userData));
    setUser(userData);
    router.replace("/");
  };

  const logout = () => {
    localStorage.removeItem("urbanpulse_auth_user");
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
