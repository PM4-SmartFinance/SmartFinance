// backend/prisma/seed.ts
import "dotenv/config"; 
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 1. Create the PostgreSQL adapter using your environment variable
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// 2. Pass the adapter into the client (Prisma 7 requires this!)
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Create the Date Dimension (Format: YYYYMMDD)
  // We dynamically generate today's date so the seed always works
  const today = new Date();
  const dateId = parseInt(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
      today.getDate()
    ).padStart(2, "0")}`
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

  // 2. Create the User
  const user = await prisma.dimUser.upsert({
    where: { email: "dev@smartfinance.local" },
    update: {},
    create: {
      email: "dev@smartfinance.local",
      name: "Local Dev User",
      password: "hashed_password_123",
    },
  });

  // 3. Create the Category (Notice the budget limit is now inside the category!)
  const category = await prisma.dimCategory.create({
    data: {
      categoryName: "Groceries",
      budgetLimit: 500.0,
      userId: user.id,
    },
  });

  // 4. Create the Merchant
  const merchant = await prisma.dimMerchant.create({
    data: {
      name: "Coop",
    },
  });

  // 5. Create the Mapping Bridge (The Rule: Coop = Groceries for this User)
  await prisma.userMerchantMapping.create({
    data: {
      userId: user.id,
      merchantId: merchant.id,
      categoryId: category.id,
    },
  });

  // 6. Create the Fact (The actual 85.50 transaction event)
  await prisma.factSpending.create({
    data: {
      amount: 85.5,
      userId: user.id,
      merchantId: merchant.id,
      dateId: dimDate.id,
    },
  });

  console.log(`✅ Seeded database successfully!`);
  console.log(`👤 Dev User created: ${user.email}`);
  console.log(`🛒 Created mapping: ${merchant.name} -> ${category.categoryName}`);
  console.log(`💸 Inserted transaction: 85.50 at ${merchant.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });