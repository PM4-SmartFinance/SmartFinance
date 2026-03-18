# KAN-28 Code Review Fixes — Backend Authentication & Authorization

## Übersicht

Die Auth-Implementierung wurde grundlegend überarbeitet: Schichtenarchitektur eingeführt, auf das produktive DB-Schema (`DimUser`) migriert, in die App-Factory integriert, und Sicherheitslücken geschlossen.

---

## 1. Kritische Fixes (Breaking)

### Prisma Model-Name: `prisma.user` → `prisma.dimUser`

- Alle DB-Zugriffe laufen jetzt über `prisma.dimUser` statt `prisma.user`
- Umgesetzt über das neue Repository-Layer (`user.repository.ts`)

### Fehlendes Pflichtfeld `defaultCurrencyId`

- Registration sucht nun die Default-Währung (CHF) in `DimCurrency` und weist sie dem neuen User zu
- Fehlt die Währung in der DB, wird ein `500`-Fehler geworfen

### Auth in produktive App integriert

- Session-Plugin (`@fastify/secure-session`) und Auth-Routes werden jetzt in `buildApp()` (`src/app.ts`) registriert
- **Gelöscht:** `src/server.ts` — wurde nur von Tests genutzt, Produktion hatte keine Auth-Endpoints
- Tests und Produktion verwenden nun dieselbe App-Factory

### Migration für `role`-Spalte erstellt

- `DimUser` hatte `role` im Prisma-Schema, aber keine Migration dafür
- **Neu:** `prisma/migrations/20260318102916_add_role_to_dim_user/migration.sql`

### PrismaClient für Prisma 7 korrigiert

- `src/prisma.ts` verwendet nun `@prisma/adapter-pg` mit `pg.Pool` — Prisma 7 erfordert dies

---

## 2. Architektur (Schichtentrennung)

### Vorher

- `src/routes/auth.ts` — Controller + Service + Repository in einer Datei
- Direkte Prisma-Aufrufe und Business-Logik in Route-Handlern
- `export default` (verstösst gegen CLAUDE.md)
- Hardcodierter Prefix `/api/v1/auth`

### Nachher

| Schicht    | Datei                                 | Verantwortung                                                                                                            |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Repository | `src/repositories/user.repository.ts` | DB-Zugriff: `findByEmail`, `createUser` (mit Transaction), `findCurrencyByCode`, `updateUserRole`, `deleteUsersByEmails` |
| Service    | `src/services/auth.service.ts`        | Business-Logik: Passwort-Hashing (Argon2), Duplikat-Prüfung, Credential-Verifikation. Kein Fastify-Import.               |
| Controller | `src/controllers/auth.controller.ts`  | HTTP-Handling: Request parsen, Service aufrufen, Session setzen, Response senden. Named Export.                          |
| Errors     | `src/errors.ts`                       | `ServiceError`-Klasse mit `statusCode` — wird vom zentralen Error-Handler verarbeitet                                    |

- Routes verwenden relative Pfade (`/auth/register`), Prefix wird bei `app.register()` übergeben
- **Gelöscht:** `src/routes/auth.ts`, `src/server.ts`, `src/routes/` (leeres Verzeichnis)

---

## 3. Sicherheit

### Session-Secret

- **Vorher:** `finalSecret.padEnd(32, "0")` — schwaches Schlüsselmaterial durch Padding
- **Nachher:** Mindestlänge 32 Zeichen in Production erzwungen, kein Padding. Dev-Default ist exakt 32 Zeichen.

### Email-Validierung

- **Vorher:** Nur `type: "string"` — jede beliebige Zeichenkette akzeptiert
- **Nachher:** Regex-Pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$` im JSON-Schema

### Passwort-Stärke

- **Vorher:** Keine Mindestlänge
- **Nachher:** `minLength: 8` im JSON-Schema

### BCRYPT_ROUNDS entfernt

- `docker-compose.yml` Zeile 51: `BCRYPT_ROUNDS` entfernt (Code nutzt Argon2)
- `.env.dev`: `BCRYPT_ROUNDS=4` entfernt

---

## 4. Code-Qualität

### Type-Safe Routes

- **Vorher:** `request.body as { email: string; password: string }`
- **Nachher:** `app.post<{ Body: AuthBody }>(...)` mit Fastify-Generics

### Konsistentes Error-Format

- **Vorher:** Auth-Errors als `{ error: "message" }`, Error-Handler als `{ error: { statusCode, message } }`
- **Nachher:** Alle Errors werden als `ServiceError` geworfen und vom zentralen `errorHandler` einheitlich als `{ error: { statusCode, message } }` formatiert

### RBAC-Validierung

- **Vorher:** `user.role as RoleType` ohne Prüfung
- **Nachher:** `if (!(user.role in ROLES))` → 403 bei unbekannter Rolle

### Tests

- Verwenden `buildApp()` statt `buildServer()` (gleiche App wie Produktion)
- Alle `prisma.user` → `prisma.dimUser`
- `beforeAll` räumt Reste vorheriger Testläufe auf und seeded CHF-Währung
- Error-Assertions an neues Format angepasst (`res.json().error.message`)
- Zwei neue Tests: ungültige Email (400), zu kurzes Passwort (400)
- Test-Only-Routes (`/api/v1/protected`, `/api/v1/admin`) nur in Test-Datei definiert

---

## 5. Cleanup

| Was                          | Aktion                         |
| ---------------------------- | ------------------------------ |
| `backend/prisma/dev.db`      | Gelöscht (SQLite-Überbleibsel) |
| `backend/.gitignore`         | `*.db` hinzugefügt             |
| `backend/src/server.ts`      | Gelöscht                       |
| `backend/src/routes/auth.ts` | Gelöscht                       |
| `backend/src/routes/`        | Leeres Verzeichnis entfernt    |

---

## 6. Test-Infrastruktur

### Neue Dateien

- **`docker-compose.test.yml`** — PostgreSQL auf Port **5433** für lokale Tests
- **`backend/.env.test`** — Umgebungsvariablen für Test-DB (`smartfinance_test`)
- **`backend/vitest.config.ts`** — Lädt `.env.test` via dotenv

### Port-Mapping

| Compose-Datei               | DB-Name             | Host-Port       |
| --------------------------- | ------------------- | --------------- |
| `docker-compose.dev.yml`    | `smartfinance`      | **5432**        |
| `docker-compose.test.yml`   | `smartfinance_test` | **5433**        |
| `docker-compose.yml` (Prod) | `smartfinance`      | nicht exponiert |

### Tests lokal ausführen

```bash
# 1. Test-DB starten
docker compose -f docker-compose.test.yml up -d

# 2. Migrationen anwenden
cd backend
DATABASE_URL="postgresql://smartfinance:smartfinance@localhost:5433/smartfinance_test" \
  bun --bun run prisma migrate deploy

# 3. Tests ausführen
bun run test
```

---

## Dateiübersicht

### Neue Dateien

- `backend/src/errors.ts`
- `backend/src/repositories/user.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/.env.test`
- `backend/prisma/migrations/20260318102916_add_role_to_dim_user/migration.sql`
- `docker-compose.test.yml`

### Geänderte Dateien

- `backend/src/app.ts` — Session-Plugin + Auth-Routes registriert
- `backend/src/prisma.ts` — Prisma 7 Adapter-Initialisierung
- `backend/src/middleware/rbac.ts` — ServiceError, Rollen-Validierung
- `backend/test/auth.spec.ts` — buildApp(), dimUser, Error-Format, neue Tests
- `backend/vitest.config.ts` — dotenv .env.test
- `backend/.env.dev` — Port 5434, BCRYPT_ROUNDS entfernt
- `backend/.gitignore` — \*.db
- `docker-compose.dev.yml` — Port 5434
- `docker-compose.yml` — BCRYPT_ROUNDS entfernt

### Gelöschte Dateien

- `backend/src/server.ts`
- `backend/src/routes/auth.ts`
- `backend/prisma/dev.db`

---

## Verifizierung

- [x] `npx prisma generate` — erfolgreich
- [x] `bun run lint` — keine Fehler
- [x] `bun run test` — 15 Tests bestanden, 1 Todo-Platzhalter
