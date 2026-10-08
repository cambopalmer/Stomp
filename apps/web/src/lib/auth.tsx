import type { AuthUser, Credentials, MeResponse, SignupInput } from "@stomp/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { api, ApiError } from "./api.js";

interface AuthState {
  user: AuthUser | null;
  googleEnabled: boolean;
  signupOpen: boolean;
  loading: boolean;
  login: (c: Credentials) => Promise<void>;
  signup: (s: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<MeResponse>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  const refresh = () => qc.invalidateQueries();

  // Keep the account's zone in step with this device — the planner's "today" is wall-clock (ADR-0006).
  const serverTz = me.data?.user?.timezone;
  useEffect(() => {
    if (!serverTz) return;
    const local = browserTimeZone();
    if (local && local !== serverTz) {
      void api
        .put("/me/timezone", { timezone: local })
        .then(() =>
          Promise.all([
            qc.invalidateQueries({ queryKey: ["auth", "me"] }),
            qc.invalidateQueries({ queryKey: ["plan"] }), // "today" and event minutes depend on the zone
          ]),
        )
        .catch(() => {}); // best effort; retried on the next load
    }
  }, [serverTz, qc]);

  const value: AuthState = {
    user: me.data?.user ?? null,
    googleEnabled: me.data?.googleEnabled ?? false,
    signupOpen: me.data?.signupOpen ?? true,
    loading: me.isLoading,
    login: async (c) => {
      await api.post<AuthUser>("/auth/login", c);
      await refresh();
    },
    signup: async (s) => {
      await api.post<AuthUser>("/auth/signup", s);
      await refresh();
    },
    logout: async () => {
      await api.post("/auth/logout").catch(() => {});
      await refresh();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export { ApiError };

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
