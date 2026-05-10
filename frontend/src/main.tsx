import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthProvider";
import { router } from "./router";
import "./index.css";

try {
  const storedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
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
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
