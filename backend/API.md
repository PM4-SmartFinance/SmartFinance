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

### POST /auth/register

Creates a new user. The first registered user receives the `ADMIN` role, all subsequent users receive `USER`.

**Request Body:**

| Field      | Type   | Required | Validation            |
| ---------- | ------ | -------- | --------------------- |
| `email`    | string | yes      | Must be a valid email |
| `password` | string | yes      | Minimum 8 characters  |

**Response 201:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "ADMIN",
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

**Response 400:** Invalid email or password too short
**Response 409:** Email already registered

---

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

Returns the currently authenticated user. Requires a valid session.

**Response 200:**

```json
{
  "user": {
    "id": "uuid",
    "role": "USER",
    "email": "user@example.com"
  }
}
```

**Response 401:** No valid session

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
| `minAmount`  | number  | no       | —       | Filter transactions with amount ≥ value                          |
| `maxAmount`  | number  | no       | —       | Filter transactions with amount ≤ value                          |

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

### POST /transactions/import

Imports transactions from a CSV file into the specified account. Requires an authenticated session with the `USER` role.

**Query Parameters:**

| Parameter   | Type   | Required | Description                                   |
| ----------- | ------ | -------- | --------------------------------------------- |
| `accountId` | string | yes      | ID of the account to import transactions into |
| `format`    | string | yes      | CSV format: `neon`, `zkb`, or `wise`          |

**Request Body:** `multipart/form-data` with a single file field containing the CSV file. Maximum file size: 10 MB.

**Response 200:**

```json
{ "imported": 42 }
```

**Response 400:** No file uploaded or missing query parameters
**Response 401:** Not authenticated
**Response 404:** Account not found or does not belong to the authenticated user
**Response 422:** CSV file is malformed, has an unrecognized format, or contains invalid data rows

---

## Budgets

All budget endpoints require an authenticated session with the `USER` role.

### GET /budgets

Returns all budgets for the authenticated user, ordered by year and month descending. Each budget includes dynamically calculated status fields: `currentSpending`, `percentageUsed`, `remainingAmount`, and `isOverBudget`.

**Response 200:**

```json
{
  "budgets": [
    {
      "id": "uuid",
      "categoryId": "uuid",
      "month": 3,
      "year": 2026,
      "limitAmount": "500.00",
      "budgetLimitDay": null,
      "budgetLimitMonth": null,
      "budgetLimitYear": null,
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

Creates a new budget for a category and calendar month.

**Request Body:**

| Field         | Type    | Required | Validation                                      |
| ------------- | ------- | -------- | ----------------------------------------------- |
| `categoryId`  | string  | yes      | Must be a valid category (user-owned or global) |
| `month`       | integer | yes      | 1–12                                            |
| `year`        | integer | yes      | >= 2000                                         |
| `limitAmount` | number  | yes      | Must be > 0                                     |

**Response 201:**

```json
{
  "budget": {
    "id": "uuid",
    "categoryId": "uuid",
    "month": 3,
    "year": 2026,
    "limitAmount": "500.00",
    "budgetLimitDay": null,
    "budgetLimitMonth": null,
    "budgetLimitYear": null,
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

**Response 400:** Invalid input (month out of range, limitAmount <= 0, missing fields)
**Response 401:** Not authenticated
**Response 404:** Category not found or does not belong to the authenticated user
**Response 409:** Budget already exists for this category and month

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
    "month": 3,
    "year": 2026,
    "limitAmount": "750.00",
    "budgetLimitDay": null,
    "budgetLimitMonth": null,
    "budgetLimitYear": null,
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
    }
  ]
}
```

### Postman Tips

- **Cookie handling:** Postman stores session cookies automatically. After login, all subsequent requests are authenticated.
- **Order:** The requests in the collection are sorted for a sequential manual test run: Register → Login → Me → Logout → Me (401).
- **Variables:** `baseUrl`, `email`, and `password` can be adjusted in the collection variables.
