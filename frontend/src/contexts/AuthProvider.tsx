import { createContext, use, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with GET /api/v1/auth/me
    const checkAuth = async () => {
      try {
        await Promise.resolve();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void checkAuth();
  }, []);

  return (
    <AuthContext value={{ isAuthenticated: user !== null, isLoading, user }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = use(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
