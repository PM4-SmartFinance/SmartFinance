/**
 * Stress tests for bulkImport.
 *
 * Require a running PostgreSQL instance (test:db:up) and are excluded from
 * the default `vitest run` / CI pipeline.
 *
 * Run manually:
 *   bun run test:stress
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { bulkImport } from "../src/repositories/transaction.repository.js";
import type { ParsedTransaction } from "../src/services/importers/types.js";

const TAG = "STRESS_BULK";

let userId: string;
let accountId: string;

function generate(
  count: number,
  uniqueDates: number,
  uniqueMerchants: number,
): ParsedTransaction[] {
  const base = new Date("2025-01-01T00:00:00Z");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + (i % uniqueDates));
    return {
      date: d,
      amount: Math.round(Math.random() * 10000) / 100,
      description: `${TAG}_Merchant_${i % uniqueMerchants}`,
      subject: `ref-${i}`,
    };
  });
}

beforeAll(async () => {
  // Seed a currency, user, and account for FK constraints
  const currency = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    update: {},
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
  });

  const user = await prisma.dimUser.create({
    data: {
      email: `${TAG}@test.local`,
      password: "hashed",
      defaultCurrencyId: currency.id,
    },
  });
  userId = user.id;

  const account = await prisma.dimAccount.create({
    data: {
      name: "Stress Account",
      iban: `${TAG}-IBAN`,
      currencyId: currency.id,
      userId,
    },
  });
  accountId = account.id;
});

afterAll(async () => {
  // Cascade from user deletes account + transactions
  await prisma.dimUser.deleteMany({ where: { email: `${TAG}@test.local` } });
  await prisma.dimMerchant.deleteMany({
    where: { name: { startsWith: `${TAG}_` } },
  });
});

describe("bulkImport stress", () => {
  it("imports 1,000 rows (30 dates, 50 merchants)", async () => {
    const rows = generate(1000, 30, 50);
    const t0 = performance.now();

    const count = await bulkImport(rows, userId, accountId);

    const ms = performance.now() - t0;
    console.log(`  1,000 rows → ${ms.toFixed(0)} ms`);
    expect(count).toBe(1000);
  }, 30_000);

  it("imports 5,000 rows (60 dates, 150 merchants)", async () => {
    const rows = generate(5000, 60, 150);
    const t0 = performance.now();

    const count = await bulkImport(rows, userId, accountId);

    const ms = performance.now() - t0;
    console.log(`  5,000 rows → ${ms.toFixed(0)} ms`);
    expect(count).toBe(5000);
  }, 60_000);

  it("imports 10,000 rows (90 dates, 200 merchants)", async () => {
    const rows = generate(10000, 90, 200);
    const t0 = performance.now();

    const count = await bulkImport(rows, userId, accountId);

    const ms = performance.now() - t0;
    console.log(`  10,000 rows → ${ms.toFixed(0)} ms`);
    expect(count).toBe(10000);
  }, 120_000);

  it("imports 50,000 rows (365 dates, 500 merchants)", async () => {
    const rows = generate(50000, 365, 500);
    const t0 = performance.now();

    const count = await bulkImport(rows, userId, accountId);

    const ms = performance.now() - t0;
    console.log(`  50,000 rows → ${ms.toFixed(0)} ms`);
    expect(count).toBe(50000);
  }, 300_000);
});
