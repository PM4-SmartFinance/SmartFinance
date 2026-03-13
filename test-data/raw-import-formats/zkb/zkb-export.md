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

[View zkb-export.csv](zkb-export.csv)
