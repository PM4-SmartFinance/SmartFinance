import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

if (process.env["NODE_ENV"] !== "production") {
  const { config } = await import("dotenv");
  config({ path: ".env" });
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
