# Import Specification: neon, officially neon Switzerland AG

**Documented by:** Shaban
**Date:** March 13, 2026

## 1. Extraction (How does the user get the CSV?)

1. Log into the mobile application (Neon is mobile only)
2. Click on Profile at the bottom right
3. Click bank statements (DE: Kontoauszüge)
4. Export the desired bank statement in CSV

## 2. File Specifications (Crucial for the parser)

- **File extension:** `.csv`
- alternative available extensions: `.pdf`

### CSV Export

- **Encoding:** charset=us-ascii
- **Delimiter:** Semicolon (`;`)
- **Text Qualifier:** Double quotes (`"`)
- **Date Format:** `YYYY-MM-DD`
- **Decimal Separator:** Dot (`.`) (e.g., `150.50`)
- **Thousands Separator:** None (e.g., `1500.50`)
- **Header Row:** Yes, on row 1.

## 3. CSV Column Structure

| CSV Column Name     | Data Type | Example             | Notes                                                           |
| :------------------ | :-------- | :------------------ | :-------------------------------------------------------------- |
| `Date`              | Date      | `2025-12-22`        | Transaction date.                                               |
| `Amount`            | Number    | `-45.20`            | Contains both debits (negative) and credits (positive).         |
| `Original amount`   | Number    | `11.00`             | Used for foreign currency transactions.                         |
| `Original currency` | String    | `USD`               |                                                                 |
| `Exchange rate`     | Number    | `0.9545`            |                                                                 |
| `Description`       | String    | `Migros Supermarkt` | In Neon, this usually contains the merchant or sender name.     |
| `Subject`           | String    | `Kartenkauf`        | Contains additional booking details or the transaction message. |
| `Category`          | String    | `uncategorized`     | Neon's internal categorization.                                 |
| `Tags`              | String    |                     | User-defined tags in the Neon app.                              |
| `Wise`              | String    |                     | Neon-specific feature for international transfers.              |
| `Spaces`            | String    |                     | Neon-specific feature for sub-accounts.                         |

## 4. Special Features / Edge Cases

- **Single Amount Column:** Unlike other banks that split debit and credit, Neon uses a single `Amount` column. Debits are natively formatted as negative numbers (e.g., `-45.20`) and credits as positive. The normalizer does **not** need to invert values.
- **Inconsistent Quoting for Empty Fields:** While populated values are always wrapped in double quotes (`"`), empty fields are inconsistent. They can appear as empty quotes (`""`) or be completely unquoted (e.g., `;;`). The parser must handle both.
- **Foreign Currency Handling:** For purchases in foreign currencies, Neon populates `Original amount`, `Original currency`, and `Exchange rate`. However, the base `Amount` column already reflects the final deducted CHF amount, so we can safely ignore the extra FX columns to keep our backend simple.

## 5. Anonymized Data Example (Raw CSV)

```csv
"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"
"2025-12-22";"-5303.70";"";"";"";"Max Muster ZKB";"Gesendet mit neon";"uncategorized";"";"no";"no"
"2025-12-19";"3113.70";"";"";"";"Arbeitgeber AG";"";"income";"";"no";"no"
"2025-08-24";"-138.55";"-146.76";"EUR";"1.05926";"wizzair.com DL1FRJ";;"uncategorized";"";"no";"no"
"2025-01-24";"-2500.00";"";"";"";"Liquiditat";"";"finances";"";"no";"yes"
"2025-01-20";"1536.00";"";"";"";"Krankenkasse AG";"Rechnung Nr.: 999999999Pramienverb Illigung06222470 Max Musterperi Ode 01.01.2024-31.12.2024";"income";"";"no";"no"
```
