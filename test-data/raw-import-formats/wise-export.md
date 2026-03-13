# Import Specification: Wise (formerly TransferWise)

**Documented by:** Shaban  
**Date:** March 13, 2026

## 1. Extraction (How does the user get the CSV?)

1. Log into the Wise mobile app
2. On the left top, click to open the menu
3. Tap on bank statements
4. Select the specific currency balance/account (e.g., CHF or EUR)
5. Click on "Statements and Reports"
6. Select the format: **CSV** (Alternative formats available: PDF, XLSX, XML/CAMT.053, MT940, QIF)
7. Select the desired date range and download

## 2. File Specifications (Crucial for the parser)

- **File extension:** `.csv`
- **Encoding:** `charset=utf-8`
- **Delimiter:** Comma (`,`) — _Note: This differs from traditional Swiss bank exports which use semicolons!_
- **Text Qualifier:** Double quotes (`"`) — _Note: Used conditionally. Only fields containing spaces, commas, or special characters are quoted._
- **Date Format:** `DD-MM-YYYY`
- **Decimal Separator:** Dot (`.`) (e.g., `-211.27`)
- **Thousands Separator:** None
- **Header Row:** Yes, on row 1.

## 3. CSV Column Structure

| CSV Column Name            | Data Type | Example                   | Notes                                                                          |
| :------------------------- | :-------- | :------------------------ | :----------------------------------------------------------------------------- |
| `TransferWise ID`          | String    | `TRANSFER-1394444852`     | Wise's internal unique transaction ID.                                         |
| `Date`                     | Date      | `29-01-2025`              | Transaction date.                                                              |
| `Date Time`                | String    | `29-01-2025 17:23:16.284` | Exact timestamp of the transaction.                                            |
| `Amount`                   | Number    | `-211.27`                 | Contains both debits (negative) and credits (positive).                        |
| `Currency`                 | String    | `EUR`                     | The currency of this specific balance/transaction.                             |
| `Description`              | String    | `Geld überwiesen an...`   | General booking text or transaction description.                               |
| `Payment Reference`        | String    |                           | User-defined reference message attached to the payment.                        |
| `Running Balance`          | Number    | `0.00`                    | Account balance after the transaction.                                         |
| `Exchange From`            | String    | `CHF`                     | Base currency for conversions.                                                 |
| `Exchange To`              | String    | `EUR`                     | Target currency for conversions.                                               |
| `Exchange Rate`            | Number    | `1.05877`                 | Applied exchange rate.                                                         |
| `Payer Name`               | String    |                           | Name of the sender (for incoming transfers).                                   |
| `Payee Name`               | String    | `Max Muster`              | Name of the recipient (for outgoing transfers).                                |
| `Payee Account Number`     | String    | `DE00...`                 | Recipient's IBAN or account number.                                            |
| `Merchant`                 | String    |                           | Filled for debit card purchases.                                               |
| `Card Last Four Digits`    | String    |                           | The last 4 digits of the card used.                                            |
| `Card Holder Full Name`    | String    |                           | Name on the card.                                                              |
| `Attachment`               | String    |                           |
| `Note`                     | String    |                           | Internal user notes added in the Wise app.                                     |
| `Total fees`               | Number    | `0.00`                    | Any fees charged for the transaction or conversion.                            |
| `Exchange To Amount`       | Number    | `211.27`                  | The final amount after currency exchange.                                      |
| `Transaction Type`         | String    | `DEBIT`                   | Text flag (`DEBIT` or `CREDIT`) indicating transaction direction.              |
| `Transaction Details Type` | String    | `TRANSFER`                | Categorizes the transaction type within Wise (e.g., `TRANSFER`, `CONVERSION`). |

## 4. Special Features / Edge Cases

- **Comma Delimiter:** The parser must be configured to split by commas `,`, not semicolons `;`.
- **Conditional Quoting:** Empty fields are completely unquoted (represented as consecutive commas `,,`). Fields without spaces are unquoted. The parser must strictly handle standard RFC 4180 CSV parsing.
- **Single Amount Column:** Debits are negative (`-211.27`), credits are positive (`211.27`).
- **Multi-Currency Conversions:** When moving money between different currency jars inside Wise, Wise logs a `CONVERSION` transaction. The normalizer needs to decide if/how to track foreign currency exchange transactions depending on whether SmartFinance supports multi-currency accounts.
- **Separate Fee Column:** Fees are explicitly broken out into a `Total fees` column. The normalizer needs to check this column and decide if fees should be subtracted from the total amount, or recorded as a completely separate expense transaction.

## 5. Anonymized Data Example (Raw CSV)

```csv
"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"
TRANSFER-1394444852,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Geld überwiesen an Max Muster",,0.00,,,,,"Max Muster",DE00000000000000000000,,,,,,0.00,,DEBIT,TRANSFER
BALANCE-3012848488,29-01-2025,"29-01-2025 17:22:40.348",211.27,EUR,"200,00 CHF zu 211,27 EUR umgetauscht",,211.27,CHF,EUR,1.05877,,,,,,,,,0.00,211.27,CREDIT,CONVERSION
```
