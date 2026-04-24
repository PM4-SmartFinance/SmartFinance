import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import { DEFAULT_CATEGORIES } from "../src/services/user.service.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  await prisma.$transaction(async (prisma) => {
    // 1. Seed currencies
    const chf = await prisma.dimCurrency.upsert({
      where: { code: "CHF" },
      update: {},
      create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    });

    await prisma.dimCurrency.upsert({
      where: { code: "EUR" },
      update: {},
      create: { code: "EUR", name: "Euro", format: "1.234,56 €" },
    });

    await prisma.dimCurrency.upsert({
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
    const hashedPassword = await argon2.hash("password123");
    const user = await prisma.dimUser.upsert({
      where: { email: "dev@smartfinance.local" },
      update: {},
      create: {
        email: "dev@smartfinance.local",
        name: "Local Dev User",
        password: hashedPassword,
        defaultCurrencyId: chf.id,
      },
    });

    // 4. Seed User's Default Categories
    console.log("Creating default categories for dev user...");
    for (const categoryName of DEFAULT_CATEGORIES) {
      await prisma.dimCategory.upsert({
        where: { userId_categoryName: { userId: user.id, categoryName } },
        update: {},
        create: {
          categoryName,
          userId: user.id,
        },
      });
      console.log(`  + Ensured category: ${categoryName}`);
    }

    // 5. Seed account
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

    // 6. Seed a specific User-Owned Category (Example of custom category)
    const userCategory = await prisma.dimCategory.upsert({
      where: { userId_categoryName: { userId: user.id, categoryName: "Hobby" } },
      update: {},
      create: {
        categoryName: "Hobby",
        userId: user.id,
      },
    });

    // 7. Seed merchant
    let merchant = await prisma.dimMerchant.findFirst({
      where: { name: "Coop" },
    });

    if (!merchant) {
      merchant = await prisma.dimMerchant.create({
        data: { name: "Coop" },
      });
      console.log("  + Created merchant: Coop");
    }

    // 8. Seed merchant-category mapping
    await prisma.userMerchantMapping.upsert({
      where: { userId_merchantId: { userId: user.id, merchantId: merchant.id } },
      update: { categoryId: userCategory.id },
      create: {
        userId: user.id,
        merchantId: merchant.id,
        categoryId: userCategory.id,
      },
    });

    // 9. Seed transaction
    const existingTx = await prisma.factTransactions.findFirst({
      where: {
        userId: user.id,
        amount: -85.5,
        merchantId: merchant.id,
        dateId: dimDate.id,
      },
    });

    if (!existingTx) {
      await prisma.factTransactions.create({
        data: {
          amount: -85.5,
          userId: user.id,
          accountId: account.id,
          merchantId: merchant.id,
          dateId: dimDate.id,
          categoryId: userCategory.id,
        },
      });
      console.log("  + Created test transaction");
    }
  });

  console.log("Seeded database successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
