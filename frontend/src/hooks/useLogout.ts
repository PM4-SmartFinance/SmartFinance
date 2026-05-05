import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface UseLogoutOptions {
  /** Path to navigate to on success/failure. Default: "/login". */
  redirectTo?: string;
  /** Path to navigate to on server-side logout failure. Default: same as redirectTo. */
  errorRedirectTo?: string;
}

export function useLogout(options: UseLogoutOptions = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const successPath = options.redirectTo ?? "/login";
  const errorPath = options.errorRedirectTo ?? successPath;

  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      navigate(successPath);
    },
    onError: () => {
      // Server-side logout failed — session may still be valid. Clear client
      // state and surface the failure via redirect path so the login page can
      // hint the user to retry.
      queryClient.clear();
      navigate(errorPath);
    },
  });
}
