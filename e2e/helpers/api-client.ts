import { request, type APIRequestContext } from "@playwright/test";
import { createReadStream } from "node:fs";

export type Role = "ADMIN" | "USER";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type Category = {
  id: string;
  categoryName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchType = "exact" | "contains" | "regex";

export type CategoryRule = {
  id: string;
  pattern: string;
  matchType: MatchType;
  categoryId: string;
  priority: number;
  userId: string;
};

export type BudgetType = "DAILY" | "MONTHLY" | "YEARLY" | "SPECIFIC_MONTH" | "SPECIFIC_MONTH_YEAR";

export type Budget = {
  id: string;
  categoryId: string;
  type: BudgetType;
  limitAmount: number;
  month: number;
  year: number;
  active: boolean;
};

export type Transaction = {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  categoryId: string | null;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(`[${status}] ${message}`);
    this.name = "ApiError";
  }
}

export async function createApiClient(baseURL: string): Promise<ApiClient> {
  const ctx = await request.newContext({ baseURL });
  return new ApiClient(ctx);
}

export class ApiClient {
  constructor(private readonly ctx: APIRequestContext) {}

  get request(): APIRequestContext {
    return this.ctx;
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.ctx.post("/api/v1/auth/login", { data: { email, password } });
    await assertOk(res, "login");
  }

  async logout(): Promise<void> {
    const res = await this.ctx.post("/api/v1/auth/logout");
    await assertOk(res, "logout");
  }

  async whoAmI(): Promise<User> {
    const res = await this.ctx.get("/api/v1/auth/me");
    const body = await assertOk<{ user: User }>(res, "whoAmI");
    return body.user;
  }

  readonly users = {
    create: async (input: {
      email: string;
      password: string;
      displayName?: string;
      role?: Role;
    }): Promise<User> => {
      const res = await this.ctx.post("/api/v1/users", { data: input });
      const body = await assertOk<{ user: User }>(res, "users.create");
      return body.user;
    },
    patch: async (
      id: string,
      input: Partial<Pick<User, "name" | "role" | "active">>,
    ): Promise<User> => {
      const res = await this.ctx.patch(`/api/v1/users/${id}`, { data: input });
      const body = await assertOk<{ user: User }>(res, "users.patch");
      return body.user;
    },
    delete: async (id: string): Promise<void> => {
      const res = await this.ctx.delete(`/api/v1/users/${id}`);
      await assertOk(res, "users.delete");
    },
    list: async (query?: {
      limit?: number;
      offset?: number;
      active?: boolean;
    }): Promise<User[]> => {
      const res = await this.ctx.get("/api/v1/users", { params: query as Record<string, string> });
      const body = await assertOk<{ items: User[] }>(res, "users.list");
      return body.items;
    },
  };

  readonly categories = {
    create: async (categoryName: string): Promise<Category> => {
      const res = await this.ctx.post("/api/v1/categories", { data: { categoryName } });
      const body = await assertOk<{ category: Category }>(res, "categories.create");
      return body.category;
    },
    list: async (): Promise<Category[]> => {
      const res = await this.ctx.get("/api/v1/categories");
      const body = await assertOk<{ categories: Category[] }>(res, "categories.list");
      return body.categories;
    },
    delete: async (id: string): Promise<void> => {
      const res = await this.ctx.delete(`/api/v1/categories/${id}`);
      await assertOk(res, "categories.delete");
    },
  };

  readonly rules = {
    create: async (input: {
      pattern: string;
      matchType: MatchType;
      categoryId: string;
      priority: number;
    }): Promise<CategoryRule> => {
      const res = await this.ctx.post("/api/v1/category-rules", { data: input });
      const body = await assertOk<{ rule: CategoryRule }>(res, "rules.create");
      return body.rule;
    },
    delete: async (id: string): Promise<void> => {
      const res = await this.ctx.delete(`/api/v1/category-rules/${id}`);
      await assertOk(res, "rules.delete");
    },
  };

  readonly budgets = {
    create: async (input: {
      categoryId: string;
      type: BudgetType;
      limitAmount: number;
      month?: number;
      year?: number;
    }): Promise<Budget> => {
      const res = await this.ctx.post("/api/v1/budgets", { data: input });
      const body = await assertOk<{ budget: Budget }>(res, "budgets.create");
      return body.budget;
    },
    delete: async (id: string): Promise<void> => {
      const res = await this.ctx.delete(`/api/v1/budgets/${id}`);
      await assertOk(res, "budgets.delete");
    },
  };

  readonly transactions = {
    importCsv: async (
      filePath: string,
      format: "neon" | "zkb" | "wise" | "ubs",
      accountId?: string,
    ): Promise<{ imported: number; categorized: number }> => {
      const params = new URLSearchParams({ format });
      if (accountId) params.set("accountId", accountId);
      const res = await this.ctx.post(`/api/v1/transactions/import?${params.toString()}`, {
        multipart: {
          file: {
            name: "import.csv",
            mimeType: "text/csv",
            buffer: await streamToBuffer(filePath),
          },
        },
      });
      return assertOk<{ imported: number; categorized: number }>(res, "transactions.importCsv");
    },
    autoCategorize: async (): Promise<{ categorized: number }> => {
      const res = await this.ctx.post("/api/v1/transactions/auto-categorize");
      return assertOk<{ categorized: number }>(res, "transactions.autoCategorize");
    },
    list: async (query?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      search?: string;
    }): Promise<{ items: Transaction[]; total: number }> => {
      // The backend response is { data, meta: { totalCount, ... } } (see
      // transaction.service.ts:255). Normalise here so spec code can stay
      // in {items, total} terms.
      const res = await this.ctx.get("/api/v1/transactions", {
        params: query as Record<string, string>,
      });
      const body = await assertOk<{ data: Transaction[]; meta: { totalCount: number } }>(
        res,
        "transactions.list",
      );
      return { items: body.data ?? [], total: body.meta?.totalCount ?? 0 };
    },
    delete: async (id: string): Promise<void> => {
      const res = await this.ctx.delete(`/api/v1/transactions/${id}`);
      await assertOk(res, "transactions.delete");
    },
  };

  readonly accounts = {
    list: async (): Promise<Array<{ id: string; name: string; iban: string }>> => {
      const res = await this.ctx.get("/api/v1/accounts");
      const body = await assertOk<{ accounts: Array<{ id: string; name: string; iban: string }> }>(
        res,
        "accounts.list",
      );
      return body.accounts;
    },
  };

  readonly dashboard = {
    summary: async (query: { startDate: string; endDate: string }) => {
      const res = await this.ctx.get("/api/v1/dashboard/summary", { params: query });
      return assertOk<{
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
        transactionCount: number;
      }>(res, "dashboard.summary");
    },
    categories: async (query: { startDate: string; endDate: string }) => {
      const res = await this.ctx.get("/api/v1/dashboard/categories", { params: query });
      return assertOk<
        {
          categoryId: string | null;
          categoryName: string;
          total: number;
          isUncategorized?: boolean;
        }[]
      >(res, "dashboard.categories");
    },
  };
}

async function assertOk<T = unknown>(
  res: Awaited<ReturnType<APIRequestContext["get"]>>,
  scope: string,
): Promise<T> {
  if (res.ok()) {
    if (res.status() === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
  let body: unknown = await res.text();
  try {
    body = JSON.parse(body as string);
  } catch {
    // keep text body
  }
  const message =
    typeof body === "object" && body && "error" in body
      ? ((body as { error: { message?: string } }).error?.message ?? scope)
      : scope;
  throw new ApiError(res.status(), message, body);
}

async function streamToBuffer(filePath: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(filePath)) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
