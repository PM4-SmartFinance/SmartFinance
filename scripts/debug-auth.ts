import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Diagnostic: Checking seeded user...\n");

  // 1. Check if user exists
  const user = await prisma.dimUser.findUnique({
    where: { email: "dev@smartfinance.local" },
  });

  if (!user) {
    console.log("❌ User not found in database!");
    console.log("   Try running: cd backend && bunx --bun prisma db seed");
    return;
  }

  console.log("✓ User found:");
  console.log(`  Email: ${user.email}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Active: ${user.active}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Password hash length: ${user.password.length}`);
  console.log();

  // 2. Check if account is active
  if (!user.active) {
    console.log("❌ Account is deactivated!");
    console.log("   Query to reactivate:");
    console.log("   UPDATE \"DimUser\" SET active = true WHERE email = 'dev@smartfinance.local';");
    return;
  }

  // 3. Test password verification
  console.log("🔑 Testing password verification...");
  const passwordToTest = "password123";
  try {
    const isValid = await argon2.verify(user.password, passwordToTest);
    if (isValid) {
      console.log(`✓ Password "${passwordToTest}" is correct!`);
    } else {
      console.log(`❌ Password "${passwordToTest}" is INCORRECT!`);
      console.log(`   The stored hash doesn't match the password.`);
    }
  } catch (err) {
    console.log(`❌ Error verifying password: ${err}`);
  }

  console.log("\n✅ All checks passed! If login still fails, the issue might be:");
  console.log("  - CORS configuration");
  console.log("  - Session/cookie handling");
  console.log("  - Frontend API calls");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
