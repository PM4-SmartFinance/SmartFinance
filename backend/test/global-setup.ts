import { execSync } from "node:child_process";
import { config } from "dotenv";

export async function setup(): Promise<void> {
  config({ path: ".env.test", override: true });

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — provide it via .env.test or environment variable");
  }

  console.log("Applying Prisma migrations to test database...");
  execSync("bunx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: process.cwd(),
  });
  console.log("Test database ready.");
}
