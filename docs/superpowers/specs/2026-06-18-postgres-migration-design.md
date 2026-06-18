# PostgreSQL Migration — Smart Business Receipt Scanner

**Date:** 2026-06-18
**Status:** Approved
**Author:** Rizki Autentika + Claude
**Depends on:** `2026-06-06-receipt-scanner-telegram-design.md`, `2026-06-14-flutter-scanner-endpoint-design.md`
**Supersedes (database layer):** Firestore data layer in the above specs

## Overview

Migrasi database backend Smart Business Receipt Scanner dari **Firestore** ke **PostgreSQL** yang di-host via Docker. Firebase Auth tetap dipakai untuk authentication. Image storage pindah dari base64 di Firestore doc ke **MinIO** (S3-compatible, Docker container).

Alasan migrasi:
- `image_base64` disimpan langsung di Firestore doc → anti-pattern (limit doc 1MB, foto >750KB gagal)
- `items[]` sebagai array JSON di doc → susah query/agregasi (laporan bulanan, sum by category)
- Akses data lebih cocok relational untuk use case FinTech/bookkeeping
- Mobile app sudah pure HTTP (dio), tidak pakai Firebase client SDK — keunggulan Firebase real-time listener tidak terpakai

## Target Stack

```
┌─────────────────────┐      ┌────────────────────────────────────────┐
│  Flutter App        │      │  Docker Host (docker-compose)          │
│  - dio HTTP         │      │                                        │
│  - bloc             │ HTTPS│  ┌──────────────────────────────────┐  │
│  - Firebase Auth SDK├──────┼─▶│  Express Server (Node.js)        │  │
│  - Polling          │      │  │  - firebase-admin (Auth only)    │  │
│                     │      │  │  - Knex.js (DB access)           │  │
└─────────────────────┘      │  │  - Tesseract OCR (existing)      │  │
                             │  │  - Telegram webhook (existing)   │  │
                             │  └────┬──────────────┬───────────────┘  │
                             │       │              │                  │
                             │  ┌────▼──────┐ ┌─────▼──────┐           │
                             │  │PostgreSQL │ │   MinIO    │           │
                             │  │ container │ │ container  │           │
                             │  │(users,    │ │(S3 bucket: │           │
                             │  │ receipts) │ │ receipts/) │           │
                             │  └───────────┘ └────────────┘           │
                             └────────────────────────────────────────┘

         ┌─────────────┐
         │ Firebase    │  Auth only (verifyIdToken)
         │ Auth (cloud)│  - User management, OAuth, password reset
         └─────────────┘  - Mobile app pakai Firebase Auth SDK
```

### Yang BERUBAH

- `firebase-admin/firestore` → `knex` + `pg`
- `image_base64` field di Firestore → MinIO object storage + `image_path` column
- Firestore subcollection pattern (`receipts/{uid}/items/{receiptId}`) → Flat `receipts` table dengan `user_id` FK
- `items[]` array di doc → `receipt_items` table relasional

### Yang TETAP

- Firebase Auth (`verifyIdToken` di server, Firebase Auth SDK di mobile)
- Express server + semua endpoints yang ada (`/webhook`, `/scan-receipt`)
- Tesseract OCR pipeline (`lib/ocr.js`, `lib/parser.js`, `lib/categorizer.js`)
- Telegram bot flow
- Mobile app dio-based HTTP client

## Data Model

### Tabel `users`

```sql
CREATE TABLE users (
  firebase_uid         VARCHAR(128) PRIMARY KEY,
  email                VARCHAR(255) NOT NULL UNIQUE,
  display_name         VARCHAR(255),
  telegram_chat_id     BIGINT UNIQUE,
  link_code            CHAR(6),
  link_code_expires_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX idx_users_link_code        ON users(link_code) WHERE link_code IS NOT NULL;
```

**Catatan:**
- `firebase_uid` sebagai PK langsung dari Firebase Auth — no separate numeric id.
- `telegram_chat_id` BIGINT (bukan VARCHAR) — chat ID Telegram bisa sampai 64-bit, BIGINT fit. Bisa negatif untuk group chat.
- Partial index untuk lookup `telegram_chat_id` dan `link_code` — dipakai di hot path (`findUserByTelegramChatId`, `handleLink`).

### Tabel `receipts`

```sql
CREATE TABLE receipts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              VARCHAR(128) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  source               VARCHAR(32) NOT NULL CHECK (source IN ('telegram', 'flutter')),
  telegram_message_id  BIGINT,
  image_path           VARCHAR(512) NOT NULL,
  ocr_raw_text         TEXT NOT NULL DEFAULT '',
  merchant_name        VARCHAR(255) NOT NULL DEFAULT '',
  total_amount         BIGINT NOT NULL DEFAULT 0,
  currency             CHAR(3) NOT NULL DEFAULT 'IDR',
  transaction_date     DATE,
  category             VARCHAR(64) NOT NULL DEFAULT 'other',
  status               VARCHAR(32) NOT NULL DEFAULT 'processing'
                       CHECK (status IN ('processing', 'needs_review', 'confirmed', 'rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at         TIMESTAMPTZ
);

CREATE INDEX idx_receipts_user_created   ON receipts(user_id, created_at DESC);
CREATE INDEX idx_receipts_user_status    ON receipts(user_id, status);
CREATE INDEX idx_receipts_user_cat_date  ON receipts(user_id, category, transaction_date);
CREATE INDEX idx_receipts_processing     ON receipts(created_at) WHERE status = 'processing';
```

**Catatan:**
- `image_path` (string pointer ke MinIO) menggantikan `image_base64`. DB tidak bloat, foto size unlimited.
- Flat table dengan `user_id` FK + index composite menggantikan subcollection `receipts/{uid}/items`.
- `total_amount` BIGINT — IDR tidak pakai sen dalam praktik. BIGINT aman untuk aggregations tahunan.
- `status` CHECK constraint — DB-level integrity.
- `transaction_date` DATE (bukan TIMESTAMPTZ) — receipt hanya butuh tanggal.
- Partial index `idx_receipts_processing` untuk `recoverStuckProcessingReceipts()` di startup.

### Tabel `receipt_items`

```sql
CREATE TABLE receipt_items (
  id          BIGSERIAL PRIMARY KEY,
  receipt_id  UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  price       BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);
```

**Catatan:**
- Tabel relasional menggantikan `items[]` array JSON di Firestore. Bisa query "berapa kali item 'Kopi' muncul" tanpa unpack array.
- `ON DELETE CASCADE` — kalau receipt dihapus, items ikut terhapus.
- `qty > 0` CHECK — mencegah data nonsense dari OCR parse error.

## API & Code Structure

### Endpoint yang berubah

| Endpoint | Sebelum (Firestore) | Sesudah (Knex + PG) |
|----------|---------------------|----------------------|
| `POST /webhook` (Telegram) | `db.collection().where().get()` | `repositories.users.findByTelegramChatId()` |
| `POST /scan-receipt` (Flutter) | `db.collection().doc().set()` + base64 in doc | Upload image ke MinIO → `repositories.receipts.create()` |
| `recoverStuckProcessingReceipts()` | `db.collectionGroup('items').where('status','==','processing')` | `repositories.receipts.findStuckProcessing()` |

### Endpoint baru untuk mobile polling

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `GET /receipts` | GET | List receipts user, paged + filter (`?status=&category=&from=&to=`) |
| `GET /receipts/:id` | GET | Detail 1 receipt + items[] |
| `PATCH /receipts/:id` | PATCH | Update receipt (confirm/edit merchant, total, category; set status `confirmed`) |
| `GET /receipts/:id/image` | GET | Redirect ke MinIO signed URL (1 menit TTL) |

Semua endpoint baru pakai Bearer token Firebase Auth yang sama dengan `/scan-receipt`.

### Polling strategy

Mobile tidak butuh WebSocket/SSE:
- Saat user buka list receipts → `GET /receipts`
- Saat user submit foto baru → `POST /scan-receipt`, navigate ke detail page, poll `GET /receipts/:id` tiap 3 detik sampai status berubah dari `processing`
- Pull-to-refresh di list page

### Code structure

```
server/
├── index.js                    # Express setup + route registration (slim)
├── package.json                # + knex, pg, minio deps
├── docker-compose.yml          # postgres + minio + server + createbucket
├── Dockerfile                  # build server image
├── .env.example                # DATABASE_URL, MINIO_*, FIREBASE_*
├── db/
│   ├── knex.js                 # Singleton Knex instance
│   ├── knexfile.js             # Migration config
│   └── migrations/
│       └── 20260618_init.js    # users + receipts + receipt_items
├── lib/
│   ├── telegram.js             # unchanged
│   ├── ocr.js                  # unchanged
│   ├── parser.js               # unchanged
│   ├── categorizer.js          # unchanged
│   ├── storage.js              # MinIO wrapper (putObject, getSignedUrl)
│   ├── auth.js                 # extract verifyToken middleware
│   └── repositories/
│       ├── users.js            # createUser, findByTelegramChatId, findByLinkCode, linkTelegram
│       └── receipts.js         # create, update, findById, listByUser, findStuckProcessing
└── routes/
    ├── webhook.js              # Telegram handler (existing logic extracted)
    ├── scanReceipt.js          # POST /scan-receipt (existing logic extracted)
    └── receipts.js             # GET/PATCH /receipts (new)
```

**Catatan struktur:**
- `lib/repositories/` isolasi SQL — route handler tidak menulis SQL langsung. Testable, swappable.
- `lib/storage.js` wrap MinIO client supaya handler tidak peduli S3 details.
- `lib/auth.js` — middleware `requireAuth(req, res, next)` yang verify token & inject `req.user.uid`. Dipakai semua protected routes.
- `routes/` — extract dari `index.js` yang akan grow. `index.js` jadi slim (~50 lines).

### Contoh perubahan kode (signature level)

**Sebelum** (`handlePhoto`):
```js
const receiptRef = db.collection("receipts").doc(user.uid).collection("items").doc();
await receiptRef.set({ image_base64, ... });
// ... OCR ...
await receiptRef.update({ status: "needs_review", ... });
```

**Sesudah:**
```js
const receipt = await repositories.receipts.create({
  user_id: user.uid,
  source: 'telegram',
  image_path: imagePath,
  status: 'processing',
  // ...
});

// ... OCR async ...

await repositories.receipts.update(receipt.id, {
  status: 'needs_review',
  merchant_name: parsed.merchantName,
  total_amount: parsed.totalAmount,
  items: parsed.items,
});
```

## Docker Setup & Image Flow

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      retries: 10
    ports:
      - "5432:5432"  # Hanya untuk dev. Production: hapus ini, internal only.

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      retries: 10
    ports:
      - "9000:9000"  # S3 API
      - "9001:9001"  # Web console

  createbucket:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
      mc mb local/${MINIO_BUCKET} --ignore-existing;
      exit 0;
      "

  server:
    build: .
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      createbucket:
        condition: service_completed_successfully
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
      FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
      PORT: 3000
    ports:
      - "3000:3000"

volumes:
  pg_data:
  minio_data:
```

### `Dockerfile` (server)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["sh", "-c", "npx knex migrate:latest && node index.js"]
```

### Image flow

**Saat receipt masuk (Telegram ATAU Flutter):**

1. Image source: Telegram photo OR base64 from Flutter → Express handler
2. Express handler:
   - Decode ke Buffer (untuk Flutter) / Download dari Telegram (untuk Telegram)
   - Generate receipt_id (UUID)
   - Object key: `receipts/{uid}/{receipt_id}.jpg`
3. `lib/storage.js` → `MinIO.putObject(buffer, key, contentType)`
4. `repositories.receipts.create({ user_id, source, image_path: key, status: 'processing', ... })`
5. Return to caller (Telegram message "Processing..." / 200 to Flutter)
6. Background (fire & forget):
   - OCR pada Buffer (yang masih di memory, tidak re-fetch dari MinIO)
   - Parse + categorize
   - `repositories.receipts.update(id, { status, merchant_name, total_amount, items, ... })` — single transaction, items insert ke `receipt_items`

**Saat mobile preview image:**

1. Mobile `GET /receipts/:id/image` (Bearer token)
2. Server:
   - Auth check → `req.user.uid`
   - Load receipt, verify `user_id == req.user.uid` (authorization)
   - `storage.getSignedUrl(receipt.image_path, expires=60s)`
   - 302 redirect ke URL MinIO
3. Mobile: download image langsung dari MinIO (1 menit window)

**Kenapa signed URL, bukan stream bytes via server?**
- Server tidak jadi proxy bandwidth
- MinIO bisa di-scale terpisah
- Lebih cepat (parallel download direct)
- 1 menit TTL = cukup untuk 1 preview, tidak leak access

### `.env.example`

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Server
PORT=3000

# PostgreSQL
POSTGRES_USER=receipt_app
POSTGRES_PASSWORD=change_me_in_prod
POSTGRES_DB=smart_business
DATABASE_URL=postgresql://receipt_app:change_me_in_prod@localhost:5432/smart_business

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change_me_in_prod
MINIO_BUCKET=receipts
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=change_me_in_prod

# Firebase Admin (Auth verification only)
# Catatan: serviceAccountKey.json masih bisa dipakai untuk dev.
# Production harus pindah ke env vars.
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Catatan ops

- `serviceAccountKey.json` tetap bisa dipakai untuk dev (sudah ada di codebase, sudah masuk `.gitignore`). Production harus pindah ke env vars untuk security.
- Production: hapus `ports: "5432:5432"` postgres dan `9000:9000` minio dari host — akses hanya internal lewat docker network.

## Migration Strategy

Karena tidak ada data existing, ini pure code rewrite. Dipecah jadi 3 PR untuk reviewability & rollback safety:

### PR 1 — Foundation (plumbing, no behavior change)

- `docker-compose.yml`, `Dockerfile`, `.env.example`
- `db/` folder: `knex.js`, `knexfile.js`, `migrations/20260618_init.js`
- `lib/storage.js` (MinIO wrapper)
- `lib/auth.js` (extract verifyToken middleware dari `/scan-receipt`)
- `lib/repositories/users.js` + `lib/repositories/receipts.js` (functions defined, belum dipanggil)
- Tidak ada perubahan pada `index.js` route handlers
- Smoke test: `docker-compose up`, migration run, MinIO bucket created

### PR 2 — Switch write path

- `/webhook` photo handler → pakai repository + storage
- `/scan-receipt` → pakai repository + storage
- `findUserByTelegramChatId`, `handleLink`, `handleStatus` → pakai `repositories/users.js`
- `processReceiptInBackground` → pakai `repositories/receipts.update()`
- `recoverStuckProcessingReceipts()` → pakai `repositories/receipts.findStuckProcessing()`
- Reads belum dibuka (mobile belum bisa polling)
- Acceptance: Telegram `/link` + send photo masih work end-to-end, data mendarat di PG + MinIO

### PR 3 — Switch read path + new endpoints + remove Firestore

- Add `routes/receipts.js` dengan `GET /receipts`, `GET /receipts/:id`, `PATCH /receipts/:id`, `GET /receipts/:id/image`
- Extract `routes/webhook.js` + `routes/scanReceipt.js` dari `index.js`
- Hapus import `firebase-admin/firestore` dari `index.js`
- Update `firestore.rules` → hapus file
- Acceptance: Flutter mobile bisa list, detail, confirm, view image

Setelah PR 3 merge: Firestore sepenuhnya tidak dipakai. Bisa deactivate di Firebase console.

## Testing Strategy

Project saat ini belum ada tests. Minimum viable tests untuk kode baru:

### Layer 1 — Repository unit tests (testcontainers + real Postgres)

```
tests/repositories/users.test.js
  - createUser → field mapping benar
  - findByTelegramChatId → null kalau tidak ketemu, data benar kalau ketemu
  - findByLinkCode → ignore expired codes
  - linkTelegram → clear link_code, set telegram_chat_id

tests/repositories/receipts.test.js
  - create → return id, row ada di DB
  - update → items[] insert ke receipt_items (atomic dengan update)
  - findById → join dengan items benar
  - listByUser → pagination + filter by status/category
  - findStuckProcessing → cuma return status='processing'
  - Authorization: user A tidak bisa update user B's receipt (return null/404)
```

### Layer 2 — Endpoint integration tests (supertest + testcontainers, mock Firebase Admin)

```
tests/routes/scan-receipt.test.js
  - 401 tanpa Bearer token
  - 401 dengan token invalid
  - 200 dengan token valid → receipt created, image uploaded ke MinIO

tests/routes/receipts.test.js
  - GET /receipts → 401 tanpa auth
  - GET /receipts → 200 dengan auth, return only user's receipts
  - GET /receipts/:id → 404 kalau receipt milik user lain (jangan leak existence)
  - PATCH /receipts/:id → update fields, set status confirmed, set confirmed_at
  - GET /receipts/:id/image → 302 redirect ke signed URL MinIO
```

### Layer 3 — Manual smoke tests (E2E yang susah di-automate)

- Telegram: send photo via bot → verify di MinIO + PG
- Flutter: capture photo → `/scan-receipt` → poll until status changes → view image

## Out of Scope

Hal berikut penting tetapi **tidak dikerjakan** dalam scope spec ini (punya spec/PR terpisah):

- **Mobile Firebase Auth SDK integration** — Flutter app masih belum ada `firebase_auth` package. Perlu ditambahkan untuk mobile dapat mengirim Bearer token. Spec terpisah.
- **Telegram webhook public URL** — butuh ngrok/reverse proxy untuk dev, atau deploy ke VPS dengan HTTPS untuk prod. Deployment concern.
- **PostgreSQL backup strategy** — `pg_dump` cron, offsite storage, PITR. Ops concern.
- **Production secrets management** — `serviceAccountKey.json`, `MINIO_ROOT_PASSWORD`, `POSTGRES_PASSWORD` di secret manager. Ops concern.
- **Monitoring & alerting** — DB connection pool, OCR failure rate, MinIO disk usage. Ops concern.

## Security Notes

- `serviceAccountKey.json` saat ini ada di working tree (`smart_business/server/serviceAccountKey.json`). File ini ada di `.gitignore`, tapi pastikan tidak pernah ke-commit. Spec ini merekomendasikan pindah ke env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — implementasikan di PR 1.
- MinIO default credentials (`minioadmin` / `minioadmin`) hanya untuk dev. Production harus set `MINIO_ROOT_PASSWORD` yang kuat.
- Signed URL TTL dibatasi 60 detik untuk image preview — minimize window kalau URL bocor.
- Endpoint `/receipts/:id` dan `/receipts/:id/image` harus verify `user_id == req.user.uid` di setiap request. Jangan percaya `:id` saja.
