import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DEV_ADMIN } from "./helpers/auth";

export const ADMIN_STORAGE_STATE = "e2e/storage-state/admin.json";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:5173";
  await mkdir(dirname(ADMIN_STORAGE_STATE), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  try {
    const res = await context.request.post("/api/v1/auth/login", {
      data: { email: DEV_ADMIN.email, password: DEV_ADMIN.password },
    });
    if (!res.ok()) {
      throw new Error(
        `[global-setup] admin login failed: ${res.status()} ${await res.text()}. ` +
          `Verify the seed ran and ${DEV_ADMIN.email} exists with ADMIN role.`,
      );
    }
    await context.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await context.close();
    await browser.close();
  }
}
