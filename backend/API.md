# SmartFinance API Documentation

Base URL: `http://localhost:3000/api/v1`

Authentication uses httpOnly session cookies. After login/register, a `session` cookie is automatically set.

---

## Health

### GET /health

Checks whether the server is reachable.

**Response 200:**

```json
{ "status": "ok" }
```

---

## Auth

### POST /auth/login

Authenticates an existing user and sets the session cookie.

**Request Body:**

| Field      | Type   | Required | Validation            |
| ---------- | ------ | -------- | --------------------- |
| `email`    | string | yes      | Must be a valid email |
| `password` | string | yes      | Minimum 8 characters  |

**Response 200:**

```json
{ "ok": true }
```

**Response 401:** Invalid credentials (email not found or wrong password)

---

### POST /auth/logout

Ends the current session. No request body required.

**Response 200:**

```json
{ "ok": true }
```

---

### GET /auth/me

Returns the currently authenticated user's full profile. Requires a valid session.

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "USER",
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

`name` is `null` when the user has not configured a display name.

**Response 401:** No valid session, or the user record was deleted (the session is cleared in this case).

---

## Users

All user endpoints require an authenticated session, except for the `POST /users` bootstrap scenario when no users exist.

### POST /users

Creates a new user. If no users exist in the system, this endpoint operates in bootstrap mode, requires no authentication, and automatically assigns the `ADMIN` role. Otherwise, it requires an authenticated `ADMIN` session.

**Request Body:**

| Field         | Type   | Required | Validation            |
| ------------- | ------ | -------- | --------------------- |
| `email`       | string | yes      | Must be a valid email |
| `password`    | string | yes      | Minimum 8 characters  |
| `displayName` | string | no       | 1–100 characters      |
| `role`        | string | no       | `ADMIN` or `USER`     |

**Response 201:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "ADMIN",
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

**Response 400:** Invalid input (email format, password too short)
**Response 401:** Not authenticated
**Response 403:** Forbidden (requires `ADMIN` role)
**Response 409:** Email already registered

---

### GET /users

Returns a paginated list of all users. Requires an authenticated session with the `ADMIN` role.

**Query Parameters:**

| Parameter | Type    | Required | Description                             |
| --------- | ------- | -------- | --------------------------------------- |
| `limit`   | integer | no       | Number of users to return (default: 50) |
| `offset`  | integer | no       | Number of users to skip (default: 0)    |

**Response 200:**

```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "active": true,
      "createdAt": "2026-03-18T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Response 401:** Not authenticated
**Response 403:** Forbidden (requires ADMIN role)

---

### GET /users/:id

Returns the profile of a specific user. Users can read their own profile; admins can read any profile.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "active": true,
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

**Response 401:** Not authenticated
**Response 403:** Forbidden
**Response 404:** User not found

---

### PATCH /users/:id

Updates a user's profile. Users can update their own `name`. Admins can update `name`, `role`, and `active` status. Admins cannot deactivate or change the role of another admin account.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:**

| Field    | Type    | Required | Validation                     |
| -------- | ------- | -------- | ------------------------------ |
| `name`   | string  | no       | Max length 255                 |
| `role`   | string  | no       | `ADMIN` or `USER` (admin only) |
| `active` | boolean | no       | true or false (admin only)     |

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "USER",
    "active": true,
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

**Response 400:** Invalid role or no updatable fields
**Response 401:** Not authenticated
**Response 403:** Forbidden — including when attempting to deactivate or change the role of another admin account
**Response 404:** User not found

---

### DELETE /users/:id

Soft-deletes a user (sets `active` to false). Users can delete themselves; admins can delete any non-admin user. Admin accounts cannot be deleted.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 204:** No content

**Response 401:** Not authenticated
**Response 403:** Forbidden — including when target is an admin account
**Response 404:** User not found

---

### POST /users/:id/reset-password

Sets a new password for the target user. Requires an authenticated session with the `ADMIN` role. An admin cannot reset another admin's password — they may reset only their own and any non-admin user's. The action is recorded as a `PASSWORD_RESET` audit event with the acting admin and the target user id.

Note: existing sessions of the target user are not invalidated by this endpoint; cookie-based sessions remain valid until they expire. Server-side session invalidation on admin reset is tracked as a follow-up.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:**

| Field         | Type   | Required | Validation           |
| ------------- | ------ | -------- | -------------------- |
| `newPassword` | string | yes      | Minimum 8 characters |

**Response 200:**

```json
{ "ok": true }
```

**Response 400:** Validation failure (`newPassword` missing or shorter than 8 characters)
**Response 401:** Not authenticated
**Response 403:** Forbidden — caller is not an admin, or attempting to reset another admin's password
**Response 404:** User not found

---

## Transactions

### GET /transactions

Returns a paginated, filtered, and sorted list of transactions belonging to the authenticated user. Requires a valid session with the `USER` role.

**Query Parameters:**

| Parameter    | Type    | Required | Default | Description                                                      |
| ------------ | ------- | -------- | ------- | ---------------------------------------------------------------- |
| `page`       | integer | no       | `1`     | Page number (minimum: 1)                                         |
| `limit`      | integer | no       | `20`    | Results per page (minimum: 1, maximum: 100)                      |
| `sortBy`     | string  | no       | `date`  | Sort field: `date`, `amount`, or `merchant`                      |
| `sortOrder`  | string  | no       | `desc`  | Sort direction: `asc` or `desc`                                  |
| `startDate`  | string  | no       | —       | Filter from date inclusive, format `YYYY-MM-DD`                  |
| `endDate`    | string  | no       | —       | Filter to date inclusive, format `YYYY-MM-DD`                    |
| `categoryId` | string  | no       | —       | Filter by category ID (matches user's merchant→category mapping) |
| `accountId`  | string  | no       | —       | Filter by account ID (UUID). Only active accounts are listed     |
| `minAmount`  | number  | no       | —       | Filter transactions with amount ≥ value                          |
| `maxAmount`  | number  | no       | —       | Filter transactions with amount ≤ value                          |

> Only transactions belonging to **active** accounts are returned. Deactivating an account hides its transactions from this endpoint without deleting them.

All filters are optional and can be combined. `minAmount` must not exceed `maxAmount`.

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "amount": "42.00",
      "date": "2025-01-15",
      "accountId": "uuid",
      "merchantId": "uuid",
      "merchant": "Grocery Store",
      "categoryId": "uuid",
      "categoryName": "Food"
    }
  ],
  "meta": {
    "totalCount": 150,
    "totalPages": 8,
    "page": 1,
    "limit": 20
  }
}
```

`amount` is returned as a string to preserve decimal precision. `categoryId` and `categoryName` are `null` when the merchant has no category mapping for the authenticated user.

**Response 400:** Invalid query parameters (wrong type, out-of-range values, or `minAmount > maxAmount`)
**Response 401:** Not authenticated

---

### POST /transactions/import/detect

Inspects an uploaded CSV header and returns a detection verdict for the import wizard, **without persisting any transactions**. The frontend uploads the file here first: a confident, unambiguous match pre-selects a built-in importer; otherwise the returned `columns` drive a manual column-mapping step. Requires an authenticated session with the `USER` role.

**Request Body:** `multipart/form-data` with a single file field containing the CSV file. Maximum file size: 10 MB.

**Response 200:**

```json
{
  "detectedFormat": "neon",
  "confidence": 1,
  "columns": ["Date", "Amount", "Description", "Subject"],
  "headerSignature": "amount|date|description|subject",
  "sampleRow": ["2025-01-15", "42.00", "Grocery Store", "ref"],
  "savedMapping": null,
  "savedMappingName": null,
  "suggestedAccountId": "b3f1c8e2-0000-0000-0000-000000000000"
}
```

| Field                | Type           | Description                                                                                                                                                                                                                |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectedFormat`     | string \| null | Built-in format (`neon`, `zkb`, `wise`, `ubs`) when matched with high confidence and unambiguously; otherwise `null`.                                                                                                      |
| `confidence`         | number         | Confidence of the leading candidate, `0`–`1`.                                                                                                                                                                              |
| `columns`            | string[]       | Header columns read from the file, shown to the user for manual mapping when `detectedFormat` is `null`.                                                                                                                   |
| `headerSignature`    | string         | Order-independent, case-insensitive key for the header, used to store/reuse a column mapping.                                                                                                                              |
| `sampleRow`          | string[]       | The file's first data row, aligned with `columns`, for the wizard's live mapping preview. Empty when there is no data row.                                                                                                 |
| `savedMapping`       | object \| null | A previously saved [column mapping](#column-mapping-payload) for this header signature, if one exists.                                                                                                                     |
| `savedMappingName`   | string \| null | The user-given name of that saved mapping, when named (see `GET /transactions/import/mappings`).                                                                                                                           |
| `suggestedAccountId` | string \| null | Account the CSV most likely belongs to — matched by an IBAN found in the file, then the UBS account-number hint, then the user's single active account; `null` if none matched. Pre-selects the wizard's account dropdown. |

**Response 400:** No file uploaded
**Response 401:** Not authenticated

---

### GET /transactions/import/mappings

Lists the authenticated user's named, reusable column mappings, for the import wizard's format dropdown. Most-recent first, de-duplicated by name. Requires an authenticated session with the `USER` role.

**Response 200:**

```json
{
  "mappings": [
    {
      "id": "f0e1d2c3-...",
      "name": "My Bank",
      "mapping": { "date": "Tag", "description": "Wer", "amount": "Summe" }
    }
  ]
}
```

A mapping becomes named by passing `mappingName` to `POST /transactions/import` with `format=custom`.

**Response 401:** Not authenticated

---

### POST /transactions/import

Imports transactions from a CSV file into the specified account. Requires an authenticated session with the `USER` role.

**Query Parameters:**

| Parameter   | Type   | Required | Description                                                                                                                                 |
| ----------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountId` | string | no       | ID of the account to import into. When omitted, the account is resolved automatically (single account, or via a file-carried account hint). |
| `format`    | string | yes      | CSV format: `neon`, `zkb`, `wise`, `ubs`, a registered plugin format, or `custom` for a mapping-driven import.                              |

**Request Body:** `multipart/form-data`. Always includes a single `file` field with the CSV (max 10 MB). When `format=custom`, it must **also** include a `mapping` field (a JSON-encoded [column mapping](#column-mapping-payload)) sent **before** the file part, and may include an optional `mappingName` field. A successful custom import saves the mapping under the file's header signature so the next import of the same bank reuses it (see `savedMapping` on the detect endpoint); when a `mappingName` is given, the mapping also becomes a reusable named option (see `GET /transactions/import/mappings`).

<a id="column-mapping-payload"></a>**Column mapping payload** (`mapping` field / `savedMapping`): maps the file's header names to canonical transaction fields.

```json
{
  "date": "Datum",
  "description": "Empfaenger",
  "amount": "Wert",
  "subject": "Referenz",
  "dateFormat": "iso"
}
```

| Field         | Type   | Required | Description                                                                                    |
| ------------- | ------ | -------- | ---------------------------------------------------------------------------------------------- |
| `date`        | string | yes      | Header name of the transaction date column.                                                    |
| `description` | string | yes      | Header name of the description / booking-text column.                                          |
| `amount`      | string | cond.    | Header name of a single signed-amount column. Mutually exclusive with `debit`/`credit`.        |
| `debit`       | string | cond.    | Header name of the debit (outflow) column. Pairs with `credit`; stored as a negative amount.   |
| `credit`      | string | cond.    | Header name of the credit (inflow) column. Pairs with `debit`; stored as a positive amount.    |
| `subject`     | string | no       | Header name of a secondary subject/reference column.                                           |
| `dateFormat`  | string | no       | Pin the date layout: `iso`, `dmy-dot`, `dmy-dash`, or `dmy-slash`. Auto-detected when omitted. |

Exactly one of `amount` or a `debit`/`credit` pair must be provided.

**Response 200:**

```json
{ "imported": 42, "categorized": 17 }
```

`imported` is the number of transactions persisted. `categorized` is the number of those (or other previously uncategorized) transactions that the rule-based engine assigned a category to as part of the post-import auto-categorization step. If the engine fails (e.g. transient DB error), the import still succeeds and `categorized` is `0` — the failure is logged server-side and users can retry via `POST /transactions/auto-categorize`.

**Response 400:** No file uploaded, missing/invalid query parameters, or (for `format=custom`) a missing/invalid `mapping` field
**Response 401:** Not authenticated
**Response 404:** Account not found or does not belong to the authenticated user
**Response 422:** CSV file is malformed, has an unrecognized format, references columns absent from the file, or contains invalid data rows

---

### POST /transactions/auto-categorize

Runs the rule-based categorization engine retroactively over all uncategorized transactions for the authenticated user. Transactions whose `manualOverride` flag is set are skipped — manual category choices are never overwritten. Requires an authenticated session with the `USER` role.

This endpoint is idempotent: running it multiple times has no additional effect once all matchable transactions have been categorized.

**Request Body:** none

**Response 200:**

```json
{ "categorized": 17 }
```

`categorized` is the number of transactions that received a category as a result of this call (the actual database-affected row count, not an optimistic estimate).

**Response 401:** Not authenticated
**Response 403:** Authenticated but does not have the `USER` role

---

### POST /transactions/recategorize

Re-applies the rule engine to every non-manual-override transaction in the supplied date range, **including transactions that already have a category**. The highest-priority matching rule wins. Transactions whose merchant matches no rule are left untouched (their previous category, if any, is preserved). Requires the `USER` role.

Use this endpoint after editing or adding rules when the user wants past transactions reclassified. `POST /transactions/auto-categorize` only touches _uncategorized_ rows; this endpoint touches all rows in range that are not manually overridden.

**Request Body:**

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31"
}
```

| Field       | Type   | Required | Validation                                                                        |
| ----------- | ------ | -------- | --------------------------------------------------------------------------------- |
| `startDate` | string | yes      | ISO date `YYYY-MM-DD`, must be a real calendar date                               |
| `endDate`   | string | yes      | ISO date `YYYY-MM-DD`, must be a real calendar date, must not precede `startDate` |

**Response 200:**

```json
{ "recategorized": 5 }
```

`recategorized` is the actual database-affected row count. Rows already in the matching category are skipped and not counted.

**Response 400:** Missing/malformed dates, invalid calendar date, or `startDate` after `endDate`
**Response 401:** Not authenticated
**Response 403:** Authenticated but does not have the `USER` role

---

### GET /transactions/:id

Returns a single transaction with its associated category, account, merchant, and date. Only the owner can access their transactions.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 200:**

```json
{
  "transaction": {
    "id": "uuid",
    "amount": "123.45",
    "notes": "Grocery run",
    "manualOverride": false,
    "createdAt": "2026-03-26T10:00:00.000Z",
    "updatedAt": "2026-03-26T10:00:00.000Z",
    "userId": "uuid",
    "accountId": "uuid",
    "account": { "name": "Main Account", "iban": "CH..." },
    "merchantId": "uuid",
    "merchant": { "name": "Migros" },
    "dateId": 20260326,
    "date": { "id": 20260326, "dayOfWeek": "Thursday", "month": 3, "year": 2026 },
    "categoryId": "uuid",
    "category": { "id": "uuid", "categoryName": "Groceries" }
  }
}
```

**Response 401:** Not authenticated
**Response 404:** Transaction not found or does not belong to the authenticated user

---

### PATCH /transactions/:id

Updates a transaction. Setting `categoryId` automatically sets `manualOverride` to `true`. At least one field must be provided.

Admins may edit any user's transaction; regular users may only edit their own (enforced by IDOR guard returning 404 for foreign rows). Every accepted edit emits a `TRANSACTION_EDIT` audit entry containing the previous and new values plus the optional `reason`. The `reason` field is **not** persisted on the transaction row — it lives only on the audit entry. When values do not change (e.g. PATCH `{ notes: "x" }` when notes were already `"x"`), no audit entry is emitted.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:** (at least one of `categoryId`, `notes`, `date`, `amount`, `reason`)

| Field        | Type   | Required | Validation                                               |
| ------------ | ------ | -------- | -------------------------------------------------------- |
| `categoryId` | string | no       | UUID; must be a category owned by the transaction's user |
| `notes`      | string | no       | Max 10,000 characters                                    |
| `date`       | string | no       | `^\d{4}-\d{2}-\d{2}$` (UTC)                              |
| `amount`     | number | no       | Decimal; stored as `Decimal(12,2)`                       |
| `reason`     | string | no       | Max 1,000 characters; recorded on the audit entry only   |

**Response 200:** Returns the updated transaction (same shape as GET).

**Response 400:** Invalid input (empty body, invalid UUID, notes/reason too long, malformed date)
**Response 401:** Not authenticated
**Response 404:** Transaction or category not found, or does not belong to the authenticated user

---

### DELETE /transactions/:id

Soft-deletes a transaction (`isDeleted = true`). The row is excluded from all transaction lists, dashboard aggregates, category breakdowns, and budget spending calculations. Admins may delete any user's transaction; regular users may only delete their own. Every accepted delete emits a `TRANSACTION_DELETE` audit entry containing the previous values plus the optional `reason`.

No restore endpoint exists in this release — soft-deleted rows are retained for audit replay only.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:** (optional)

| Field    | Type   | Required | Validation                                             |
| -------- | ------ | -------- | ------------------------------------------------------ |
| `reason` | string | no       | Max 1,000 characters; recorded on the audit entry only |

The `reason` MUST be sent in the request body, not on the querystring — putting free-text in the URL would leak it into Pino/reverse-proxy access logs.

**Response 204:** No content

**Response 400:** `reason` exceeds 1,000 characters
**Response 401:** Not authenticated
**Response 404:** Transaction not found or does not belong to the authenticated user

---

### GET /audit-logs

Lists audit log entries with pagination and filtering. **ADMIN-only.**

**Query Parameters:**

| Parameter       | Type    | Required | Validation                                                                                             |
| --------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `page`          | integer | no       | Min 1, default 1                                                                                       |
| `limit`         | integer | no       | Min 1, max 100, default 20                                                                             |
| `userId`        | string  | no       | Filter to entries with this actor `userId`                                                             |
| `action`        | string  | no       | Filter to entries with this exact `action` (e.g. `TRANSACTION_DELETE`, `LOGIN_FAILED`, `ROLE_CHANGED`) |
| `transactionId` | string  | no       | Filter to entries tied to this transaction id                                                          |
| `startDate`     | string  | no       | ISO 8601 date-time; inclusive lower bound on `createdAt`                                               |
| `endDate`       | string  | no       | ISO 8601 date-time; inclusive upper bound on `createdAt`                                               |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "action": "TRANSACTION_EDIT",
      "userId": "uuid|null",
      "transactionId": "uuid|null",
      "previousValues": { "notes": "old" },
      "changedValues": { "notes": "new" },
      "reason": "Corrected description",
      "createdAt": "2026-05-18T12:34:56.000Z"
    }
  ],
  "meta": {
    "totalCount": 123,
    "totalPages": 7,
    "page": 1,
    "limit": 20
  }
}
```

Results are ordered by `createdAt DESC`. `previousValues` / `changedValues` are JSON blobs whose shape depends on `action`; for cross-user actions performed by an admin, `changedValues.targetUserId` records the affected user.

**Response 400:** Invalid query (e.g. `limit > 100`, malformed `startDate`/`endDate`)
**Response 401:** Not authenticated
**Response 403:** Authenticated but not ADMIN

---

## Dashboard

All dashboard endpoints require an authenticated session with the `USER` role.

### GET /dashboard/trends

Returns daily aggregated income and expenses for the requested date range. Frontends downsample client-side for week/month/quarter/year views.

**Query Parameters:**

| Parameter   | Type   | Required | Validation            | Description                                        |
| ----------- | ------ | -------- | --------------------- | -------------------------------------------------- |
| `startDate` | string | yes      | `^\d{4}-\d{2}-\d{2}$` | Inclusive range start (UTC)                        |
| `endDate`   | string | yes      | `^\d{4}-\d{2}-\d{2}$` | Inclusive range end (UTC)                          |
| `accountId` | string | no       | UUID                  | Limit to one account; omit for all active accounts |

The response is ordered from oldest day to newest day. Days without transactions are included with `income = 0` and `expenses = 0` (gap-filled).

`income` is the sum of positive transaction amounts on that day. `expenses` is the sum of absolute values of negative transaction amounts on that day.

**Response 200:**

```json
{
  "data": [
    {
      "date": "2025-12-01",
      "income": 0,
      "expenses": 0
    },
    {
      "date": "2025-12-15",
      "income": 2450.75,
      "expenses": 980.2
    }
  ]
}
```

**Response 400:** Missing or malformed `startDate` / `endDate`, or `startDate` > `endDate`
**Response 401:** Not authenticated

---

## Budgets

All budget endpoints require an authenticated session with the `USER` role.

### GET /budgets

Returns all budgets for the authenticated user, ordered by type, then year and month descending. Each budget includes dynamically calculated status fields: `currentSpending`, `percentageUsed`, `remainingAmount`, and `isOverBudget`.

**Response 200:**

```json
{
  "budgets": [
    {
      "id": "uuid",
      "categoryId": "uuid",
      "type": "MONTHLY",
      "month": 0,
      "year": 0,
      "limitAmount": "500.00",
      "active": true,
      "currentSpending": "142.50",
      "percentageUsed": 28.5,
      "remainingAmount": "357.50",
      "isOverBudget": false,
      "createdAt": "2026-03-27T10:00:00.000Z",
      "updatedAt": "2026-03-27T10:00:00.000Z"
    }
  ]
}
```

**Response 401:** Not authenticated

---

### POST /budgets

Creates a new budget for a category. Supports six budget types: general recurring (`DAILY`, `MONTHLY`, `YEARLY`) and specific period (`SPECIFIC_MONTH`, `SPECIFIC_YEAR`, `SPECIFIC_MONTH_YEAR`).

**Request Body:**

| Field         | Type    | Required    | Validation                                                                                     |
| ------------- | ------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `categoryId`  | string  | yes         | Must be a valid category (user-owned or global)                                                |
| `type`        | string  | yes         | One of: `DAILY`, `MONTHLY`, `YEARLY`, `SPECIFIC_MONTH`, `SPECIFIC_YEAR`, `SPECIFIC_MONTH_YEAR` |
| `limitAmount` | number  | yes         | Must be > 0                                                                                    |
| `month`       | integer | conditional | Required for `SPECIFIC_MONTH` and `SPECIFIC_MONTH_YEAR` (1–12)                                 |
| `year`        | integer | conditional | Required for `SPECIFIC_YEAR` and `SPECIFIC_MONTH_YEAR` (>= 2000)                               |

**Response 201:**

```json
{
  "budget": {
    "id": "uuid",
    "categoryId": "uuid",
    "type": "MONTHLY",
    "month": 0,
    "year": 0,
    "limitAmount": "500.00",
    "active": true,
    "currentSpending": "0",
    "percentageUsed": 0,
    "remainingAmount": "500.00",
    "isOverBudget": false,
    "createdAt": "2026-03-27T10:00:00.000Z",
    "updatedAt": "2026-03-27T10:00:00.000Z"
  }
}
```

**Response 400:** Invalid input (invalid type, missing required month/year for type, limitAmount <= 0)
**Response 401:** Not authenticated
**Response 404:** Category not found or does not belong to the authenticated user
**Response 409:** Budget already exists for this category and type

---

### PATCH /budgets/:id

Updates the spending limit of an existing budget. Only budgets owned by the authenticated user can be updated.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:**

| Field         | Type   | Required | Validation  |
| ------------- | ------ | -------- | ----------- |
| `limitAmount` | number | yes      | Must be > 0 |

**Response 200:**

```json
{
  "budget": {
    "id": "uuid",
    "categoryId": "uuid",
    "type": "MONTHLY",
    "month": 0,
    "year": 0,
    "limitAmount": "750.00",
    "active": true,
    "currentSpending": "142.50",
    "percentageUsed": 19,
    "remainingAmount": "607.50",
    "isOverBudget": false,
    "createdAt": "2026-03-27T10:00:00.000Z",
    "updatedAt": "2026-03-27T10:30:00.000Z"
  }
}
```

**Response 400:** Invalid input (limitAmount <= 0)
**Response 401:** Not authenticated
**Response 404:** Budget not found or does not belong to the authenticated user

---

### DELETE /budgets/:id

Deletes a budget. Only budgets owned by the authenticated user can be deleted.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 204:** No content

**Response 401:** Not authenticated
**Response 404:** Budget not found or does not belong to the authenticated user

---

## Users

All user endpoints require an authenticated session with the `USER` role.

### GET /users/me

Returns the full profile of the currently authenticated user.

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "USER",
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

**Response 401:** Not authenticated
**Response 404:** User record not found

---

### PATCH /users/me

Updates the display name and/or email address of the authenticated user. The session cookie is refreshed automatically when the email changes.

**Request Body:**

| Field         | Type   | Required | Validation                              |
| ------------- | ------ | -------- | --------------------------------------- |
| `displayName` | string | no       | 1–100 characters                        |
| `email`       | string | no       | Must match `^[^\s@]+@[^\s@]+\.[^\s@]+$` |

At least one field must be present; an empty body returns the current profile unchanged.

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "email": "new@example.com",
    "name": "Jane Doe",
    "role": "USER"
  }
}
```

**Response 400:** Validation failure (field too short, invalid email pattern)
**Response 401:** Not authenticated
**Response 409:** Email already in use by another account

---

### POST /users/me/change-password

Changes the password of the authenticated user. The current session is invalidated on success — the client must re-authenticate.

**Request Body:**

| Field             | Type   | Required | Validation           |
| ----------------- | ------ | -------- | -------------------- |
| `currentPassword` | string | yes      | Must not be empty    |
| `newPassword`     | string | yes      | Minimum 8 characters |

**Response 200:**

```json
{ "ok": true }
```

**Response 400:** Validation failure (newPassword too short)
**Response 401:** Not authenticated or current password incorrect

---

## Categories

All category endpoints require an authenticated session with the `USER` role.

### GET /categories

Returns all categories available to the authenticated user — this includes their generated default examples and any custom categories they have created.

**Response 200:**

```json
[
  {
    "id": "uuid",
    "categoryName": "Groceries",
    "userId": "uuid",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:00:00.000Z"
  },
  {
    "id": "uuid",
    "categoryName": "Tennis",
    "userId": "uuid",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-01T12:00:00.000Z"
  }
]
```

**Response 401:** Not authenticated

### POST /categories

Creates a new custom category for the authenticated user.

**Request Body:**

| Field          | Type   | Required | Validation      |
| -------------- | ------ | -------- | --------------- |
| `categoryName` | string | yes      | 1–50 characters |

**Response 201:**

```json
{
  "id": "uuid",
  "categoryName": "Tennis",
  "userId": "uuid",
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-04-01T12:00:00.000Z"
}
```

**Response 400:** Missing or invalid `categoryName`
**Response 401:** Not authenticated
**Response 409:** Category with this name already exists for this user

### PATCH /categories/:id

Updates the name of a user's own custom category.

**Request Body:**

| Field          | Type   | Required | Validation      |
| -------------- | ------ | -------- | --------------- |
| `categoryName` | string | yes      | 1–50 characters |

**Response 200:**

```json
{
  "id": "uuid",
  "categoryName": "Squash",
  "userId": "uuid",
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-04-08T14:00:00.000Z"
}
```

**Response 400:** Missing or invalid `categoryName`, or invalid UUID
**Response 401:** Not authenticated
**Response 404:** Category not found or not owned by authenticated user

### DELETE /categories/:id

Deletes a user's own custom category. Deletion is blocked if the category is currently referenced by transactions, budgets, rules, or merchant mappings.

**Response 204:** Category deleted (no body)

**Response 400:** Invalid UUID
**Response 401:** Not authenticated
**Response 404:** Category not found or not owned by authenticated user
**Response 409:** Category is in use by transactions, budgets, rules, or merchant mappings and cannot be deleted

---

## Accounts

All account endpoints require an authenticated session with the `USER` role.

### GET /accounts

Returns all accounts belonging to the authenticated user. Active accounts are listed first, then by name.

**Response 200:**

```json
{
  "accounts": [
    {
      "id": "uuid",
      "name": "Main Account",
      "iban": "CH93 0076 2011 6238 5295 7",
      "accountNumber": "1234 5678 9101",
      "active": true
    }
  ]
}
```

`accountNumber` is the bank-provided account/card number (nullable) used to auto-match CSV imports; `active` is `false` for deactivated accounts.

**Response 401:** Not authenticated

---

### POST /accounts

Creates an account for the authenticated user. The account currency defaults to the user's configured default currency (not user-selectable).

**Request Body:**

| Field           | Type           | Required | Description                                                     |
| --------------- | -------------- | -------- | --------------------------------------------------------------- |
| `name`          | string         | yes      | Display name (1–100 chars)                                      |
| `iban`          | string         | yes      | IBAN (5–42 chars, letters/digits/spaces). Unique per user       |
| `accountNumber` | string \| null | no       | Bank account/card number (≤ 64 chars), used for import matching |

**Response 201:** `{ "account": { "id", "name", "iban", "accountNumber", "active" } }`

**Response 400:** Validation failed
**Response 401:** Not authenticated
**Response 409:** An account with this IBAN already exists

---

### PATCH /accounts/:id

Updates an account owned by the authenticated user. At least one field must be provided. Setting `active: false` **deactivates** the account — its transactions remain in the database but are hidden from the transactions view and excluded from import resolution. Setting `active: true` reactivates it.

**Request Body (all optional, min one):**

| Field           | Type           | Description                                |
| --------------- | -------------- | ------------------------------------------ |
| `name`          | string         | Display name (1–100 chars)                 |
| `iban`          | string         | IBAN (unique per user)                     |
| `accountNumber` | string \| null | Bank account/card number; `null` clears it |
| `active`        | boolean        | Activate / deactivate the account          |

**Response 200:** `{ "account": { ... } }`

**Response 400:** Validation failed
**Response 401:** Not authenticated
**Response 404:** Account not found or not owned by the user
**Response 409:** An account with this IBAN already exists

---

### DELETE /accounts/:id

Permanently deletes an account owned by the authenticated user. **Delete policy:** an account that still has transactions cannot be hard-deleted (the FK is `ON DELETE CASCADE`, so deletion would destroy transaction history). Deactivate it instead.

**Response 204:** Deleted
**Response 401:** Not authenticated
**Response 404:** Account not found or not owned by the user
**Response 409:** Account still has transactions — body carries `error.code = "ACCOUNT_HAS_TRANSACTIONS"` and `error.transactionCount`

---

## Category Rules

All category rule endpoints require an authenticated session with the `USER` role.

### GET /category-rules

Returns all category rules for the authenticated user, ordered by priority descending.

**Response 200:**

```json
{
  "rules": [
    {
      "id": "uuid",
      "pattern": "Migros",
      "matchType": "contains",
      "priority": 10,
      "categoryId": "uuid",
      "userId": "uuid",
      "createdAt": "2026-03-29T10:00:00.000Z",
      "updatedAt": "2026-03-29T10:00:00.000Z",
      "isValid": true,
      "category": {
        "id": "uuid",
        "categoryName": "Groceries"
      }
    }
  ]
}
```

`isValid` is `false` only for `regex` rules whose stored pattern can no longer compile (e.g. left over from a less strict validator). Categorization silently skips these rules; clients should flag them in the UI.

**Response 401:** Not authenticated

---

### GET /category-rules/:id

Returns a single category rule by ID.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 200:**

```json
{
  "rule": {
    "id": "uuid",
    "pattern": "Migros",
    "matchType": "contains",
    "priority": 10,
    "categoryId": "uuid",
    "userId": "uuid",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:00:00.000Z",
    "category": {
      "id": "uuid",
      "categoryName": "Groceries"
    }
  }
}
```

**Response 400:** Invalid UUID
**Response 401:** Not authenticated
**Response 404:** Rule not found or does not belong to the authenticated user

---

### POST /category-rules

Creates a new category rule.

**Request Body:**

| Field        | Type    | Required | Validation                                                                                                                             |
| ------------ | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern`    | string  | yes      | 1–256 chars. For `"regex"` type, must be a valid JavaScript regex and pass a complexity check (no catastrophic-backtracking patterns). |
| `matchType`  | string  | yes      | `"exact"`, `"contains"`, or `"regex"`                                                                                                  |
| `categoryId` | string  | yes      | UUID, must be a valid category (user-owned or global)                                                                                  |
| `priority`   | integer | yes      | >= 0                                                                                                                                   |

**Regex matching:** When `matchType` is `"regex"`, the `pattern` is evaluated as a case-insensitive regular expression against the full merchant name. For example, `Migros.*Online` matches `"Migros Online"` and `"Migros Bahnhof Online"`, while `^Migros$` matches only the exact string `"Migros"`.

**Response 201:**

```json
{
  "rule": {
    "id": "uuid",
    "pattern": "Migros",
    "matchType": "contains",
    "priority": 10,
    "categoryId": "uuid",
    "userId": "uuid",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:00:00.000Z",
    "category": {
      "id": "uuid",
      "categoryName": "Groceries"
    }
  }
}
```

**Response 400:** Invalid input (missing fields, invalid matchType, non-UUID categoryId, extra properties, invalid regex pattern)
**Response 401:** Not authenticated
**Response 404:** Category not found or does not belong to the authenticated user
**Response 409:** A rule with this pattern and match type already exists

---

### POST /category-rules/preview

Previews matching transactions for a proposed rule without creating it. Returns the count of uncategorized transactions that would match the pattern, along with up to 3 sample transactions. Useful for live preview as the user edits the rule pattern.

**Request Body:**

| Field        | Type    | Required | Validation                                                                                                                             |
| ------------ | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern`    | string  | yes      | 1–256 chars. For `"regex"` type, must be a valid JavaScript regex and pass a complexity check (no catastrophic-backtracking patterns). |
| `matchType`  | string  | yes      | `"exact"`, `"contains"`, or `"regex"`                                                                                                  |
| `categoryId` | string  | yes      | UUID, must be a valid category (user-owned or global)                                                                                  |
| `priority`   | integer | yes      | >= 0                                                                                                                                   |

For `regex` patterns the preview also runs against the database with a 2 s statement timeout. If the pattern is syntactically valid in JavaScript but rejected by Postgres' POSIX regex engine, or if it exceeds the timeout, the endpoint returns 400 with a descriptive message.

**Response 200:**

```json
{
  "matchCount": 7,
  "matchedTransactions": [
    {
      "id": "uuid",
      "merchantName": "Migros",
      "amount": -42.5,
      "dateId": 20260401
    },
    {
      "id": "uuid",
      "merchantName": "Migros City",
      "amount": -18.75,
      "dateId": 20260325
    }
  ]
}
```

`matchCount` is the total number of uncategorized transactions that match the pattern. `matchedTransactions` is an array of up to 3 recent matching transactions, ordered by date descending then by ID ascending. If no transactions match, `matchedTransactions` is an empty array.

**Response 400:** Invalid input (missing fields, invalid matchType, invalid UUID, invalid regex pattern)
**Response 401:** Not authenticated
**Response 404:** Category not found or does not belong to the authenticated user

---

### GET /category-rules/overlap

Returns rules whose pattern overlaps with the supplied candidate. Used by the rule editor as a soft warning — overlap does not block saving. Priority disambiguates at evaluation time. Requires the `USER` role.

Two patterns overlap (case-insensitive) when at least one merchant string can satisfy both:

- `exact` vs `exact`: equal patterns
- `exact` vs `contains`: the contains pattern is a substring of the exact pattern
- `contains` vs `exact`: the contains pattern is a substring of the exact pattern (mirror)
- `contains` vs `contains`: either pattern contains the other

**Query Parameters:**

| Parameter       | Type   | Required | Validation                                                              |
| --------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `pattern`       | string | yes      | Non-empty                                                               |
| `matchType`     | string | yes      | `"exact"` or `"contains"`                                               |
| `excludeRuleId` | string | no       | UUID — pass when editing an existing rule to exclude it from the result |

**Response 200:**

```json
{
  "conflicts": [
    {
      "id": "uuid",
      "pattern": "coop migros",
      "matchType": "contains",
      "priority": 5,
      "categoryId": "uuid",
      "categoryName": "Hobby"
    }
  ]
}
```

`conflicts` is an empty array when no other user-owned rule overlaps. The list excludes the rule referenced by `excludeRuleId` (when supplied) so the editor does not flag a rule against itself.

**Response 400:** Invalid input (missing required parameter, invalid matchType, invalid UUID)
**Response 401:** Not authenticated
**Response 403:** Authenticated but does not have the `USER` role

---

### PATCH /category-rules/:id

Updates an existing category rule. Only rules owned by the authenticated user can be updated. At least one field must be provided.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Request Body:**

| Field        | Type    | Required | Validation                                                                                                                             |
| ------------ | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pattern`    | string  | no       | 1–256 chars. For `"regex"` type, must be a valid JavaScript regex and pass a complexity check (no catastrophic-backtracking patterns). |
| `matchType`  | string  | no       | `"exact"`, `"contains"`, or `"regex"`                                                                                                  |
| `categoryId` | string  | no       | UUID, must be a valid category (user-owned or global)                                                                                  |
| `priority`   | integer | no       | >= 0                                                                                                                                   |

**Response 200:**

```json
{
  "rule": {
    "id": "uuid",
    "pattern": "Migros",
    "matchType": "contains",
    "priority": 20,
    "categoryId": "uuid",
    "userId": "uuid",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:30:00.000Z",
    "category": {
      "id": "uuid",
      "categoryName": "Groceries"
    }
  }
}
```

**Response 400:** Invalid input (empty body, invalid matchType, non-UUID categoryId, extra properties, invalid regex pattern)
**Response 401:** Not authenticated
**Response 404:** Rule or category not found, or does not belong to the authenticated user
**Response 409:** A rule with this pattern and match type already exists

---

### DELETE /category-rules/:id

Deletes a category rule. Only rules owned by the authenticated user can be deleted.

**Path Parameters:**

| Parameter | Type   | Validation |
| --------- | ------ | ---------- |
| `id`      | string | UUID       |

**Response 204:** No content

**Response 401:** Not authenticated
**Response 404:** Rule not found or does not belong to the authenticated user

---

## Modules

The extension module system lets bundled and third-party modules register routes, dashboard nav items, widgets, and importer plugins at app startup. Every module runs in an isolated Fastify plugin scope under the prefix `/api/v1/modules/<moduleId>` and receives a namespace-isolated JSON storage adapter — modules cannot read each other's data, modify the database schema, or call the repository layer directly.

A module is only registered if its `id` matches `^[a-z0-9][a-z0-9-]{0,63}$` and its `init()` returns successfully. If `init()` throws, the module is logged and skipped; any routes, nav items, widgets, or importer plugins it tried to register during that aborted init are discarded, so a failing module never partially mounts itself.

The two modules shipped today are `mock-bank` (an importer plugin used to demonstrate the plugin pipeline) and `savings-goals` (a CRUD example with a dashboard widget). Their endpoints are documented under [Module: `savings-goals`](#module-savings-goals) below.

### GET /modules

Lists all successfully registered modules. The `error` field on `getStatus()` output is intentionally redacted from this response; admins can fetch the full status via `GET /modules/:moduleId/status`.

**Authentication:** `USER`

**Response 200:**

```json
{
  "modules": [
    {
      "id": "mock-bank",
      "name": "Mock Bank",
      "requiredRole": "USER",
      "status": { "initialized": true }
    },
    {
      "id": "savings-goals",
      "name": "Savings Goals",
      "requiredRole": "USER",
      "status": { "initialized": true }
    }
  ]
}
```

**Response 401:** Not authenticated

### GET /modules/nav-items

Returns the navigation entries that registered modules want surfaced in the dashboard navigation. Used by the frontend to populate module links beside the built-in routes.

**Authentication:** `USER`

**Response 200:**

```json
{
  "navItems": [
    {
      "moduleId": "savings-goals",
      "label": "Savings Goals",
      "path": "/modules/savings-goals"
    }
  ]
}
```

**Response 401:** Not authenticated

### GET /modules/widgets

Returns dashboard widget descriptors registered by modules. Each entry's `dataEndpoint` is constrained at registration time to start with `/modules/<moduleId>/`, preventing modules from advertising endpoints outside their own namespace.

**Authentication:** `USER`

**Response 200:**

```json
{
  "widgets": [
    {
      "moduleId": "savings-goals",
      "widgetId": "savings-goals-summary",
      "title": "Savings Goals",
      "dataEndpoint": "/modules/savings-goals/goals/widget"
    }
  ]
}
```

**Response 401:** Not authenticated

### GET /modules/:moduleId/status

Returns full status for a single registered module, including the human-readable `error` message if its init reported one. Restricted to `ADMIN` because the error message may reveal internal failure context.

**Authentication:** `ADMIN`

**Path Parameters:**

| Field      | Type   | Required | Validation                             |
| ---------- | ------ | -------- | -------------------------------------- |
| `moduleId` | string | yes      | Must match `^[a-z0-9][a-z0-9-]{0,63}$` |

**Response 200:**

```json
{
  "id": "savings-goals",
  "name": "Savings Goals",
  "status": { "initialized": true }
}
```

**Response 401:** Not authenticated
**Response 403:** Forbidden (requires `ADMIN` role)
**Response 404:** Module not found (either unknown id or registration failed)

---

### Module: `savings-goals`

Per-user savings goals. Each user's goals live in namespace-isolated storage and cannot be read or modified by another user. All routes require `USER`.

#### GET /modules/savings-goals/goals

Lists every savings goal owned by the authenticated user. On the first call after a deploy that introduces per-record storage, any legacy `goals` array key is migrated to per-record entries transparently.

**Response 200:**

```json
{
  "goals": [
    {
      "id": "8e6f...",
      "name": "Emergency Fund",
      "targetAmount": 5000,
      "currentAmount": 1200
    }
  ]
}
```

**Response 401:** Not authenticated

#### POST /modules/savings-goals/goals

Creates a new savings goal. `currentAmount` always starts at `0`.

**Request Body:**

| Field          | Type   | Required | Validation                               |
| -------------- | ------ | -------- | ---------------------------------------- |
| `name`         | string | yes      | 1–200 chars, must not be whitespace-only |
| `targetAmount` | number | yes      | Strictly greater than `0`                |

**Response 201:**

```json
{
  "goal": {
    "id": "8e6f...",
    "name": "Emergency Fund",
    "targetAmount": 5000,
    "currentAmount": 0
  }
}
```

**Response 400:** Invalid body (missing name, empty name, non-positive targetAmount)
**Response 401:** Not authenticated

#### PATCH /modules/savings-goals/goals/:goalId

Partially updates a goal. Any subset of `name`, `targetAmount`, and `currentAmount` may be supplied.

**Path Parameters:**

| Field    | Type   | Required |
| -------- | ------ | -------- |
| `goalId` | string | yes      |

**Request Body:**

| Field           | Type   | Validation                               |
| --------------- | ------ | ---------------------------------------- |
| `name`          | string | 1–200 chars, must not be whitespace-only |
| `targetAmount`  | number | Strictly greater than `0`                |
| `currentAmount` | number | Non-negative                             |

**Response 200:**

```json
{
  "goal": {
    "id": "8e6f...",
    "name": "Emergency Fund",
    "targetAmount": 6000,
    "currentAmount": 1200
  }
}
```

**Response 400:** Invalid body
**Response 401:** Not authenticated
**Response 404:** Goal not found, or belongs to a different user (IDOR guard)

#### DELETE /modules/savings-goals/goals/:goalId

Deletes a goal.

**Response 204:** No content
**Response 401:** Not authenticated
**Response 404:** Goal not found, or belongs to a different user (IDOR guard)

#### GET /modules/savings-goals/goals/widget

Widget-friendly summary used by the dashboard `ModuleWidgetCard`. Each item carries a clamped 0–100 `progress` percentage.

**Response 200:**

```json
{
  "items": [
    {
      "id": "8e6f...",
      "label": "Emergency Fund",
      "detail": "1200.00 / 5000.00",
      "progress": 24
    }
  ],
  "emptyMessage": "No savings goals yet. Create your first goal!"
}
```

**Response 401:** Not authenticated

---

## Dashboard

All dashboard endpoints require an authenticated session with the `USER` role.

All dashboard endpoints aggregate only transactions on the user's **active** accounts. The optional `accountId` query parameter narrows the result to a single account; an inactive or non-owned id simply yields zeros.

### GET /dashboard/summary

Returns aggregated financial totals for the authenticated user within the specified date range.

**Query Parameters:**

| Parameter   | Type   | Required | Validation                   |
| ----------- | ------ | -------- | ---------------------------- |
| `startDate` | string | yes      | ISO date format `YYYY-MM-DD` |
| `endDate`   | string | yes      | ISO date format `YYYY-MM-DD` |
| `accountId` | string | no       | UUID — limit to one account  |

**Response 200:**

```json
{
  "totalIncome": 1500.0,
  "totalExpenses": -800.0,
  "netBalance": 700.0,
  "transactionCount": 5
}
```

- `totalIncome` — sum of all positive-amount transactions in the range
- `totalExpenses` — sum of all negative-amount transactions in the range (negative value)
- `netBalance` — `totalIncome + totalExpenses`
- `transactionCount` — total number of transactions (income + expense) in the range

All values are `0` when there are no transactions in the range. Use `transactionCount` to distinguish an empty period from a zero-sum period.

**Response 400:** Missing or malformed `startDate`/`endDate`, invalid calendar date (e.g. month 13), or `startDate` is after `endDate`
**Response 401:** Not authenticated

---

### GET /dashboard/categories

Returns expense totals grouped by category for the authenticated user within the specified date range. Intended to power the spending-by-category bar chart on the dashboard.

**Query Parameters:**

| Parameter   | Type   | Required | Validation                   |
| ----------- | ------ | -------- | ---------------------------- |
| `startDate` | string | yes      | ISO date format `YYYY-MM-DD` |
| `endDate`   | string | yes      | ISO date format `YYYY-MM-DD` |
| `accountId` | string | no       | UUID — limit to one account  |

**Response 200:**

```json
[
  {
    "categoryId": "uuid",
    "categoryName": "Groceries",
    "total": 150.0
  },
  {
    "categoryId": "uuid",
    "categoryName": "Transport",
    "total": 0
  },
  {
    "categoryId": null,
    "categoryName": "Uncategorized",
    "total": 88.5,
    "isUncategorized": true
  }
]
```

| Field             | Type           | Notes                                                                    |
| ----------------- | -------------- | ------------------------------------------------------------------------ |
| `categoryId`      | string \| null | UUID for tracked categories; `null` for the synthetic Uncategorized row  |
| `categoryName`    | string         | Category display name; literally `"Uncategorized"` for the synthetic row |
| `total`           | number         | Absolute value of summed expenses in CHF, rounded to two decimals        |
| `isUncategorized` | boolean (opt.) | Present and `true` only on the synthetic Uncategorized row               |

- Only expense transactions (negative amounts) are aggregated. Positive-amount (income) transactions are excluded.
- **Every category owned by the user is returned**, including categories with zero spend in the range (`total: 0`). This lets the chart show the full set of categories the user is tracking.
- Tracked categories are sorted by `total` descending; ties broken by `categoryName` ascending.
- A synthetic **Uncategorized** row aggregates expenses with `categoryId IS NULL`. It is **pinned to the end of the array** (regardless of total) and is **omitted entirely when its `total` is 0**.
- Returns `200 []` only when the user has no categories at all (rare — the bootstrap flow seeds defaults).

**Response 400:** Missing or malformed `startDate`/`endDate`, invalid calendar date (e.g. month 13), or `startDate` is after `endDate`
**Response 401:** Not authenticated

---

## Error Format

All errors are formatted uniformly by the centralized error handler:

```json
{
  "error": {
    "statusCode": 401,
    "message": "Unauthorized"
  }
}
```

Validation errors (400) from Fastify use their own format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/email must match pattern \"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\""
}
```

---

## Postman Collection

The following JSON can be imported directly into Postman: **Import > Raw text > Paste**

```json
{
  "info": {
    "name": "SmartFinance API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api/v1"
    },
    {
      "key": "email",
      "value": "test@example.com"
    },
    {
      "key": "password",
      "value": "Password123!"
    }
  ],
  "item": [
    {
      "name": "Health",
      "item": [
        {
          "name": "Health Check",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/health"
          }
        }
      ]
    },
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 201', () => pm.response.to.have.status(201));",
                  "pm.test('Has user', () => pm.expect(pm.response.json().user).to.have.property('id'));"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/register",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}"
            }
          }
        },
        {
          "name": "Login",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has session cookie', () => {",
                  "  const cookie = pm.response.headers.get('set-cookie');",
                  "  pm.expect(cookie).to.include('session');",
                  "});"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/login",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}"
            }
          }
        },
        {
          "name": "Get Current User",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has user email', () => pm.expect(pm.response.json().user).to.have.property('email'));"
                ]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/auth/me"
          }
        },
        {
          "name": "Logout",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('ok is true', () => pm.expect(pm.response.json().ok).to.be.true);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/logout"
          }
        },
        {
          "name": "Get Current User (after logout, expect 401)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 401', () => pm.response.to.have.status(401));"]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/auth/me"
          }
        },
        {
          "name": "Register — invalid email (expect 400)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 400', () => pm.response.to.have.status(400));"]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/register",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"not-an-email\",\n  \"password\": \"Password123!\"\n}"
            }
          }
        },
        {
          "name": "Register — short password (expect 400)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 400', () => pm.response.to.have.status(400));"]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/register",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"short@example.com\",\n  \"password\": \"short\"\n}"
            }
          }
        },
        {
          "name": "Register — duplicate email (expect 409)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 409', () => pm.response.to.have.status(409));"]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/register",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}"
            }
          }
        },
        {
          "name": "Login — wrong password (expect 401)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 401', () => pm.response.to.have.status(401));"]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/auth/login",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"WrongPassword!\"\n}"
            }
          }
        }
      ]
    },
    {
      "name": "Users",
      "item": [
        {
          "name": "Get My Profile",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has user', () => pm.expect(pm.response.json().user).to.have.property('id'));"
                ]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/users/me"
          }
        },
        {
          "name": "Update Profile",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has updated name', () => pm.expect(pm.response.json().user.name).to.equal('Jane Doe'));"
                ]
              }
            }
          ],
          "request": {
            "method": "PATCH",
            "url": "{{baseUrl}}/users/me",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"displayName\": \"Jane Doe\"\n}"
            }
          }
        },
        {
          "name": "Change Password",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('ok is true', () => pm.expect(pm.response.json().ok).to.be.true);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/users/me/change-password",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"currentPassword\": \"{{password}}\",\n  \"newPassword\": \"NewPassword123!\"\n}"
            }
          }
        }
      ]
    },
    {
      "name": "Accounts",
      "item": [
        {
          "name": "List Accounts",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has accounts array', () => pm.expect(pm.response.json().accounts).to.be.an('array'));"
                ]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/accounts"
          }
        }
      ]
    },
    {
      "name": "Budgets",
      "item": [
        {
          "name": "List Budgets",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has budgets array', () => pm.expect(pm.response.json().budgets).to.be.an('array'));"
                ]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/budgets"
          }
        },
        {
          "name": "Create Budget",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 201', () => pm.response.to.have.status(201));",
                  "pm.test('Has budget', () => pm.expect(pm.response.json().budget).to.have.property('id'));",
                  "pm.collectionVariables.set('budgetId', pm.response.json().budget.id);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/budgets",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"categoryId\": \"{{categoryId}}\",\n  \"month\": 3,\n  \"year\": 2026,\n  \"limitAmount\": 500\n}"
            }
          }
        },
        {
          "name": "Update Budget",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Updated limitAmount', () => pm.expect(Number(pm.response.json().budget.limitAmount)).to.equal(750));"
                ]
              }
            }
          ],
          "request": {
            "method": "PATCH",
            "url": "{{baseUrl}}/budgets/{{budgetId}}",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"limitAmount\": 750\n}"
            }
          }
        },
        {
          "name": "Delete Budget",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 204', () => pm.response.to.have.status(204));"]
              }
            }
          ],
          "request": {
            "method": "DELETE",
            "url": "{{baseUrl}}/budgets/{{budgetId}}"
          }
        },
        {
          "name": "Create Budget — duplicate (expect 409)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 409', () => pm.response.to.have.status(409));"]
              }
            }
          ],
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/budgets",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"categoryId\": \"{{categoryId}}\",\n  \"month\": 3,\n  \"year\": 2026,\n  \"limitAmount\": 300\n}"
            }
          }
        }
      ]
    },
    {
      "name": "Dashboard",
      "item": [
        {
          "name": "Summary",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": [
                  "pm.test('Status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Has totalIncome', () => pm.expect(pm.response.json()).to.have.property('totalIncome'));",
                  "pm.test('Has totalExpenses', () => pm.expect(pm.response.json()).to.have.property('totalExpenses'));",
                  "pm.test('Has netBalance', () => pm.expect(pm.response.json()).to.have.property('netBalance'));",
                  "pm.test('Has transactionCount', () => pm.expect(pm.response.json()).to.have.property('transactionCount'));"
                ]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{baseUrl}}/dashboard/summary?startDate=2025-01-01&endDate=2025-12-31",
              "host": ["{{baseUrl}}"],
              "path": ["dashboard", "summary"],
              "query": [
                { "key": "startDate", "value": "2025-01-01" },
                { "key": "endDate", "value": "2025-12-31" }
              ]
            }
          }
        },
        {
          "name": "Summary — missing params (expect 400)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 400', () => pm.response.to.have.status(400));"]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/dashboard/summary"
          }
        },
        {
          "name": "Summary — unauthenticated (expect 401)",
          "event": [
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["pm.test('Status 401', () => pm.response.to.have.status(401));"]
              }
            }
          ],
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/dashboard/summary?startDate=2025-01-01&endDate=2025-12-31"
          }
        }
      ]
    }
  ]
}
```

### Postman Tips

- **Cookie handling:** Postman stores session cookies automatically. After login, all subsequent requests are authenticated.
- **Order:** The requests in the collection are sorted for a sequential manual test run: Register → Login → Me → Logout → Me (401).
- **Variables:** `baseUrl`, `email`, and `password` can be adjusted in the collection variables.
