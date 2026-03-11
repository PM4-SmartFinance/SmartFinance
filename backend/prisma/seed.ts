// backend/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  const user = await prisma.user.create({
    data: {
      email: "dev@smartfinance.local",
      name: "Local Dev User",
      categories: {
        create: [
          {
            name: "Groceries",
            categoryRules: {
              create: [{ merchantMatch: "Coop" }],
            },
          },
        ],
      },
    },
    include: {
      categories: true,
    },
  });

  const groceryCategory = user.categories.find((c) => c.name === "Groceries");

  if (!groceryCategory) {
    throw new Error("Failed to find the seeded category");
  }

  await prisma.budget.create({
    data: {
      amount: 500.0,
      month: 3,
      year: 2026,
      userId: user.id,
      categoryId: groceryCategory.id,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      date: new Date(),
      merchant: "Coop",
      totalAmount: 85.5,
      lineItems: {
        create: [
          {
            description: "Weekly Groceries",
            amount: 85.5,
            categoryId: groceryCategory.id,
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded database successfully!`);
  console.log(`👤 Dev User created: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
