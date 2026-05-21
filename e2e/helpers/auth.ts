import { ApiClient, createApiClient } from "./api-client";

export const DEV_ADMIN = {
  email: "dev@smartfinance.local",
  password: "password123",
} as const;

export const E2E_PASSWORD = "E2E-Password-123!";

export async function loginAsAdmin(baseURL: string): Promise<ApiClient> {
  const client = await createApiClient(baseURL);
  await client.login(DEV_ADMIN.email, DEV_ADMIN.password);
  return client;
}

export async function loginAs(
  baseURL: string,
  email: string,
  password: string,
): Promise<ApiClient> {
  const client = await createApiClient(baseURL);
  await client.login(email, password);
  return client;
}
