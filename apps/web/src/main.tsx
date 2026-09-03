import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { ApiError } from "./lib/api.js";
import { AuthProvider } from "./lib/auth.js";
import { WorkspaceProvider } from "./lib/workspace.js";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: false } },
  // a 401 anywhere means the session went away — re-check auth so the app shows /login
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== "auth") {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
