import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthProvider";
import { router } from "./router";
import { I18nErrorBoundary } from "./components/I18nErrorBoundary";
import "./lib/i18n";
import "./index.css";

try {
  const storedTheme = localStorage.getItem("theme");
  const prefersDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  const isSystem = storedTheme === "system" || storedTheme === null;
  if (storedTheme === "dark" || (isSystem && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
} catch {
  // Pre-hydration theme is best-effort. The store retries via applyThemeToDOM
  // on first render in environments where storage / matchMedia throw
  // (Safari Private Mode, sandboxed iframes, restricted webviews).
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nErrorBoundary>
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </I18nErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
