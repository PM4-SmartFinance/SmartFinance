# Import Specification: UBS (UBS Switzerland AG)

**Documented by:** Shaban
**Date:** April 3, 2026

## 1. Extraction (How does the user get the CSV?)

1. Log into UBS e-banking on the webapp
2. Navigate to your credit card account
3. Open the transaction list / statement
4. Export as CSV

## 2. File Specifications (Crucial for the parser)

- **File extension:** `.csv`
- **Encoding:** `charset=iso-8859-1` (Latin-1) — _Note: Contains German umlauts (e.g., Währung, Zürich) encoded in ISO 8859-1, not UTF-8._
- **Delimiter:** Declared on row 1 via `sep=;` — Semicolon (`;`)
- **Text Qualifier:** Double quotes (`"`)
- **Date Format:** `DD.MM.YYYY`
- **Decimal Separator:** Dot (`.`) (e.g., `1.70`)
- **Thousands Separator:** None
- **Header Row:** Yes, on row 2 (row 1 is the `sep=;` delimiter declaration).

## 3. CSV Column Structure

| CSV Column Name        | Data Type | Example                     | Notes                                                                      |
| :--------------------- | :-------- | :-------------------------- | :------------------------------------------------------------------------- |
| `Kontonummer`          | String    | `1234 5678 9101`            | Account number.                                                            |
| `Kartennummer`         | String    | `9999 99XX XXXX 9999`       | Card number. **Can be empty** for non-card transactions (e.g., transfers). |
| `Konto-/Karteninhaber` | String    | `M. MUSTERMANN`             | Account or card holder name.                                               |
| `Einkaufsdatum`        | Date      | `21.07.2025`                | Transaction/purchase date.                                                 |
| `Buchungstext`         | String    | `Laden6   Zürich       CHE` | Merchant name, location, and country code.                                 |
| `Branche`              | String    | `Lebensmittelgeschäft`      | Merchant category. Can be empty for non-card transactions.                 |
| `Betrag`               | Number    | `1.7`                       | Transaction amount in original currency.                                   |
| `Originalwährung`      | String    | `CHF`                       | Original transaction currency.                                             |
| `Kurs`                 | Number    |                             | Exchange rate. Empty when original currency matches account currency.      |
| `Währung`              | String    | `CHF`                       | Account currency.                                                          |
| `Belastung`            | Number    | `1.7`                       | Debit amount. Natively positive in CSV.                                    |
| `Gutschrift`           | Number    | `100.5`                     | Credit amount. Natively positive in CSV.                                   |
| `Buchung`              | Date      | `23.07.2025`                | Booking/settlement date.                                                   |

## 4. Special Features / Edge Cases

- **`sep=;` Prefix Line:** The first line of the file is `sep=;`, which declares the delimiter. The parser must read the delimiter from this line and skip it before parsing the header.
- **Split Debit and Credit Columns:** Debits (`Belastung`) and Credits (`Gutschrift`) are in separate columns. Both contain _positive_ numbers. The normalizer must read the `Belastung` column and convert the value to a negative number for our backend.
- **Footer / Total Rows:** The CSV ends with summary rows (e.g., `Total pro Währung`, `Total Kartenbuchungen`). These rows have empty date fields or `Total` in the booking text. The parser must skip them.
- **Empty Card Number:** Non-card transactions (e.g., account transfers like `UEBERTRAG VON KONTO`) have an empty `Kartennummer` field.
- **ISO-8859-1 Encoding:** The original file uses ISO-8859-1 encoding for German umlauts. When reading as UTF-8, characters like `ü`, `ä`, `ö` may appear as mojibake (`�`). The backend handles encoding conversion at the upload boundary.

## 5. Anonymized Data Example (Raw CSV)

[View ubs-export.csv](ubs-export.csv)
