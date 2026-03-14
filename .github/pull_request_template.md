## Summary
*(e.g., Initializes the database layer by implementing a Star Schema architecture for SmartFinance.)*

---

## Changes
*(e.g., Added FactSpending and DimUser tables to /prisma/schema.prisma; updated the seeding script to populate dimension tables first.)*

---

## Verified
- [ ] `bun install` succeeds.
- [ ] `docker compose up -d postgres` runs healthy.
- [ ] `npx prisma migrate dev` successfully generates and applies SQL migrations.
- [ ] `npx prisma generate` produces valid TypeScript types in `node_modules`.
- [ ] `npx prisma db seed` successfully populates all 6 tables without constraint errors.
- [ ] Verified via **Prisma Studio** that `FactSpending` correctly links to all relevant dimension IDs.
- [ ] Verified that `DATABASE_URL` is correctly parsed from `.env`.

---

## Notes
*(e.g., Used a Star Schema over traditional normalization to improve reporting performance.)*