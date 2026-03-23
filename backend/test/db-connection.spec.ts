import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Database connection", () => {
  it("connects to PostgreSQL and executes a query", async () => {
    const result = await prisma.$queryRaw<[{ one: number }]>`SELECT 1 AS one`;
    expect(Number(result[0].one)).toBe(1);
  });

  it("has applied migrations (DimUser table exists)", async () => {
    const count = await prisma.dimUser.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
