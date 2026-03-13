# Import Specification: Zürcher Kantonalbank (ZKB)

**Documented by:** Shaban  
**Date:** March 13, 2026

## 1. Extraction (How does the user get the CSV?)

1. Log into ZKB e-banking on the webapp
2. Navigate to _Account & Payments_
3. Select your account
4. Click at the top right on _Bank Statements_
5. Select the desired account and date range
6. Click on _CSV_ - it opens a dropdown
7. In the dropdown, click on _with details_

## 2. File Specifications (Crucial for the parser)

- **File extension:** `.csv`
- **Encoding:** `charset=utf-8`
- **Delimiter:** Semicolon (`;`)
- **Text Qualifier:** Double quotes (`"`)
- **Date Format:** `DD.MM.YYYY`
- **Decimal Separator:** Dot (`.`) (e.g., `4.10`)
- **Thousands Separator:** None (e.g., `4000.00`)
- **Header Row:** Yes, on row 1.

## 3. CSV Column Structure

| CSV Column Name    | Data Type | Example                      | Notes                                                                   |
| :----------------- | :-------- | :--------------------------- | :---------------------------------------------------------------------- |
| `Date`             | Date      | `13.03.2026`                 | Transaction date. **Can be empty** for sub-transaction detail rows.     |
| `Booking text`     | String    | `Purchase ZKB Visa Debit...` | Contains merchant name, card details, or transaction type.              |
| `Curr`             | String    | `CHF`                        | Often empty. Usually only populated on sub-transaction detail rows.     |
| `Amount details`   | Number    | `804.30`                     | **Only used for sub-transactions**. Empty on standard transaction rows. |
| `ZKB reference`    | String    | `L113P1119ZAQR68W-2`         | ZKB's internal transaction ID.                                          |
| `Reference number` | String    |                              | External reference number, if provided.                                 |
| `Debit CHF`        | Number    | `4.10`                       | Outflow. Natively positive in CSV.                                      |
| `Credit CHF`       | Number    | `25.00`                      | Inflow. Natively positive in CSV.                                       |
| `Value date`       | Date      | `11.03.2026`                 | Valuta date.                                                            |
| `Balance CHF`      | Number    | `302.89`                     | Running balance after the transaction.                                  |
| `Payment purpose`  | String    | `Miete März 2026`            | Contains user-defined notes, invoice details, or TWINT messages.        |
| `Details`          | String    | `Max Muster, Musterweg 1...` | Contains address details of the sender/recipient.                       |

## 4. Special Features / Edge Cases

- **Split Debit and Credit Columns:** Debits (`Debit CHF`) and Credits (`Credit CHF`) are in separate columns. Both contain _positive_ numbers. The normalizer must read the `Debit CHF` column and convert the value to a negative number for our backend.
- **Split Bookings / Sub-transactions (CRITICAL):** Collective payments (e.g., paying multiple e-bills at once) appear as one main row with a total in `Debit CHF`. Directly underneath, ZKB adds detail rows. **These detail rows have an empty `Date` column, empty `Debit/Credit` columns, but contain values in `Curr` and `Amount details`.** The normalizer must decide whether to import the summary row or the detail rows, otherwise amounts will be double-counted!
- **Always Quoted:** Every field is wrapped in double quotes (`""`), even empty ones.

## 5. Anonymized Data Example (Raw CSV)

```csv
"Date";"Booking text";"Curr";"Amount details";"ZKB reference";"Reference number";"Debit CHF";"Credit CHF";"Value date";"Balance CHF";"Payment purpose";"Details"
"13.03.2026";"Credit TWINT: MAX MUSTER +41790000000";"";"";"L113P1119ZAQR68W-2";"";"";"25.00";"13.03.2026";"327.89";"";""
"13.03.2026";"Purchase ZKB Visa Debit card no. xxxx 7900, Coop Pronto 5751 0862";"";"";"L115B1119Z9YM6HQ-1";"";"1.95";"";"11.03.2026";"302.89";"";""
"09.03.2026";"Debit Mobile Banking (2)";"";"";"Z260688053425";"";"894.30";"";"09.03.2026";"789.94";"";""
"";"Krankenkasse AG, Zahlungsverkehr, 8004 Zürich, CH";"CHF";"804.30";"";"";"";"";"";"";"Prämie 01.01. - 31.12.2026 / Kundennummer 47.29361-5";""
"";"Verein Beispiel, Vereinsstrasse 25, 8000 Zürich, CH";"CHF";"90.00";"";"";"";"";"";"";"";""
"25.02.2026";"Credit originator: Max Muster, Musterstrasse 4, 8000 Zürich ZH";"";"";"Z260563278817";"";"";"4000.00";"25.02.2026";"3867.16";"Gesendet mit neon";"Max Muster, Musterstrasse 4, 8000 Zürich ZH, CH"
```
