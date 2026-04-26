import { useState, useEffect, useCallback } from "react";
import { authApi, setToken, clearToken } from "@/lib/api-client";

interface User {
  sub: string;
  email: string;
  role: string;
}

function parseJwt(token: string): User | null {
  try {
    return JSON.parse(atob(token.split(".")[1] ?? "")) as User;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cf_token");
    if (token) setUser(parseJwt(token));
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (res.success && res.data) {
      setToken(res.data.token);
      setUser(parseJwt(res.data.token));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, login, logout, isAuthenticated: !!user };
}
