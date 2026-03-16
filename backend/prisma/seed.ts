import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // 1. Seed currencies
  const chf = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    update: {},
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
  });

  const eur = await prisma.dimCurrency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", name: "Euro", format: "1.234,56 €" },
  });

  const usd = await prisma.dimCurrency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "US Dollar", format: "$1,234.56" },
  });

  // 2. Seed date dimension
  const today = new Date();
  const dateId = parseInt(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`,
  );

  const dimDate = await prisma.dimDate.upsert({
    where: { id: dateId },
    update: {},
    create: {
      id: dateId,
      dayOfWeek: today.toLocaleDateString("en-US", { weekday: "long" }),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    },
  });

  // 3. Seed user
  const user = await prisma.dimUser.upsert({
    where: { email: "dev@smartfinance.local" },
    update: {},
    create: {
      email: "dev@smartfinance.local",
      name: "Local Dev User",
      password: "hashed_password_123",
      defaultCurrencyId: chf.id,
    },
  });

  // 4. Seed account
  const account = await prisma.dimAccount.upsert({
    where: { userId_iban: { userId: user.id, iban: "CH93 0076 2011 6238 5295 7" } },
    update: {},
    create: {
      name: "Main Account",
      iban: "CH93 0076 2011 6238 5295 7",
      currencyId: chf.id,
      userId: user.id,
    },
  });

  // 5. Seed category
  const category = await prisma.dimCategory.upsert({
    where: { userId_categoryName: { userId: user.id, categoryName: "Groceries" } },
    update: {},
    create: {
      categoryName: "Groceries",
      budgetLimitMonth: 500.0,
      userId: user.id,
    },
  });

  // 6. Seed merchant
  const merchant = await prisma.dimMerchant.create({
    data: { name: "Coop" },
  });

  // 7. Seed merchant-category mapping
  await prisma.userMerchantMapping.create({
    data: {
      userId: user.id,
      merchantId: merchant.id,
      categoryId: category.id,
    },
  });

  // 8. Seed transaction
  await prisma.factTransactions.create({
    data: {
      amount: 85.5,
      userId: user.id,
      accountId: account.id,
      merchantId: merchant.id,
      dateId: dimDate.id,
    },
  });

  console.log("Seeded database successfully!");
  console.log(`  User: ${user.email}`);
  console.log(`  Account: ${account.name} (${account.iban})`);
  console.log(`  Currencies: ${chf.code}, ${eur.code}, ${usd.code}`);
  console.log(`  Mapping: ${merchant.name} -> ${category.categoryName}`);
  console.log(`  Transaction: 85.50 at ${merchant.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
