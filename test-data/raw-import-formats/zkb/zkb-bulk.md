# Bulk Test Fixture: ZKB

**Companion to:** [`zkb-export.md`](zkb-export.md) (format spec) and [`zkb-bulk.csv`](zkb-bulk.csv) (data).
**Purpose:** Volume / performance / dashboard-rendering testing of the SmartFinance import pipeline against a realistically distributed dataset.

## 1. Origin

Synthetic, fully anonymized export. Matches the real ZKB CSV format documented in `zkb-export.md` exactly (encoding, delimiter, quoting, column order, date format, decimal separator, sub-transaction rule).

## 2. Volume

| Metric                                                                                  | Value                   |
| --------------------------------------------------------------------------------------- | ----------------------- |
| File size                                                                               | ~787 KB                 |
| Total CSV rows                                                                          | 6505                    |
| Importable main transactions (rows with non-empty `Date`)                               | 6414                    |
| Split-booking detail rows (rows with empty `Date`, populated `Curr` + `Amount details`) | 91                      |
| Date span                                                                               | 2021-01-01 → 2026-05-01 |
| Final running balance (top of file)                                                     | ~138 129 CHF            |

## 3. Year Distribution

| Year | Main transactions |
| ---- | ----------------- |
| 2021 | 894               |
| 2022 | 665               |
| 2023 | 1156              |
| 2024 | 1566              |
| 2025 | 1632              |
| 2026 | 501               |

Skewed toward more recent years — mirrors a real account where activity grows over time.

## 4. Edge Cases Covered

The fixture deliberately exercises several parser paths:

- **Split bookings / sub-transactions.** Every `Debit eBanking Mobile (N)` collective payment is followed by `N` detail rows with empty `Date`, populated `Curr = CHF` and `Amount details`. The ZKB parser at `backend/src/services/importers/zkb.parser.ts:56-58` skips these — fixture verifies the skip path stays correct under volume.
- **Maestro vs Visa Debit cards.** Older rows (2021–2022) use `ZKB Maestro card no. xxxx 0000`; newer rows use `ZKB Visa Debit card no. xxxx 0000`. Both shapes are present in the booking text.
- **ATM operations.** `Deposit CHF Coins`, `Deposit CHF Bills`, `Withdrawal by ZKB Maestro card no.` exercise non-purchase booking texts.
- **eBill standing orders & LSV.** `Debit eBill: Salt Mobile SA…`, `Debit Standing order: …`, `Debit from LSV with right of objection: …` cover recurring-debit categories.
- **TWINT credits and debits.** Both directions across many counterparties (`Person001`–`Person*`).
- **Online vs in-store purchases.** `Online purchase ZKB Visa Debit…` vs `Purchase ZKB Visa Debit…`.
- **Account transfers and incoming credits.** `Credit originator: …`, `Credit Account transfer: …`, `Credit TWINT: …`, including `Gesendet mit neon` payment-purpose marker.
- **Optional `Payment purpose` and `Details`.** Some rows populated, most empty — exercises the parser's tolerance for variable trailing fields.
- **Running `Balance CHF`.** Backfilled chronologically from a positive starting balance; never goes negative; sub-rows leave the column empty (matches real export behaviour).

## 5. Anonymization

| Field         | Treatment                                                            |
| ------------- | -------------------------------------------------------------------- |
| Names         | `Person001`–`PersonNNN`                                              |
| Phone numbers | `<phone-NNN>`                                                        |
| Card numbers  | `xxxx 0000` (uniform across Maestro and Visa Debit rows)             |
| References    | `TX00001`–`TX05714` (synthetic) and `REF_REDACTED` for non-card refs |
| Addresses     | `<anon address>`                                                     |
| IBANs         | None present                                                         |

Verified zero hits for: real names from the developer team, real phone numbers (`+41…`), real IBANs (`CH..`).

## 6. Intended Use

- Import-pipeline performance: validate the **50 000-transaction quality target** in `CLAUDE.md` by cycling this fixture through the pipeline ~8× and measuring per-batch timing.
- Dashboard render budget: confirm the **2 s render budget for up to 50 k transactions** holds against this dataset.
- Categorization-rule recall: once `CategoryRule` rows are seeded, this fixture lets you measure the **85 % auto-categorization accuracy** target (see § 7).
- UI smoke tests: pagination, filtering, date-range selectors against multi-year data.

## 7. Caveats

- **Categorization rule seed gap.** As of this fixture's introduction, `backend/prisma/seed.ts` does not seed any `CategoryRule` rows. `autoCategorize` will return `categorized: 0` until rules are added. Booking text in this fixture embeds category labels (`Groceries`, `Restaurant / food`, `Public transport`, `Convenience / kiosk`, `Fuel station`, `Government / tax`, `Insurance / health`, `Other vendor`, `Online retail`, `Utilities`) so a small set of `contains`-pattern rules will match a high share of merchants once seeded.
- **Balance is reconstructed**, not original — figures are internally consistent (sum of debits/credits matches the running balance) but not derived from a real account.
- **Final balance is high** (~138 k CHF) because the synthetic ledger is net positive over five years. Treat as a perf fixture, not as a budget realism reference.

## 8. Regenerating

Mutations applied via `.claude/review/scripts/fix-zkb-bulk.ts` (one-shot script). Run again only when the upstream fixture is replaced — the script is idempotent for card-number unification but rewrites Balance CHF on every run.
