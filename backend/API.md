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
    }
  ]
}
```

### Postman Tips

- **Cookie handling:** Postman stores session cookies automatically. After login, all subsequent requests are authenticated.
- **Order:** The requests in the collection are sorted for a sequential manual test run: Register → Login → Me → Logout → Me (401).
- **Variables:** `baseUrl`, `email`, and `password` can be adjusted in the collection variables.
