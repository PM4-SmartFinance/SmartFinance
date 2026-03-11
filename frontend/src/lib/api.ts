const BASE_URL = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON error body — leave as null
    }
    const message = (body as { message?: string } | null)?.message ?? response.statusText;
    throw new ApiError(response.status, body, message);
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, { ...init, method: "DELETE" }),
};
