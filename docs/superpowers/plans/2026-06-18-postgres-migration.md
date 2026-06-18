# PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate backend database from Firestore to PostgreSQL (Docker), image storage from base64 in Firestore docs to MinIO (Docker), keep Firebase Auth for authentication.

**Architecture:** Express server uses Knex.js for PostgreSQL access (repositories pattern), MinIO client for image storage, Firebase Admin SDK for token verification only. Three sequential PRs: Foundation (plumbing) → Switch write path → Switch read path + remove Firestore.

**Tech Stack:** Node.js 20, Express 5, PostgreSQL 16, Knex.js, MinIO, firebase-admin (Auth only), Tesseract.js (existing), Jest + testcontainers (testing).

**Spec:** `docs/superpowers/specs/2026-06-18-postgres-migration-design.md`

---

## File Structure

```
smart_business/server/
├── package.json                    # MODIFY: add knex, pg, minio, jest, testcontainers, supertest
├── index.js                        # MODIFY across PRs (eventually slim)
├── .env.example                    # MODIFY: add DATABASE_URL, MINIO_*, FIREBASE_*
├── jest.config.js                  # NEW
├── docker-compose.yml              # NEW
├── Dockerfile                      # NEW
├── db/
│   ├── knex.js                     # NEW: singleton Knex instance
│   ├── knexfile.js                 # NEW: migration config
│   └── migrations/
│       └── 20260618_init.js        # NEW: users + receipts + receipt_items
├── lib/
│   ├── telegram.js                 # unchanged
│   ├── ocr.js                      # unchanged
│   ├── parser.js                   # unchanged
│   ├── categorizer.js              # unchanged
│   ├── firebase.js                 # NEW: Admin SDK init (env vars + file fallback)
│   ├── auth.js                     # NEW: requireAuth middleware
│   ├── storage.js                  # NEW: MinIO wrapper
│   └── repositories/
│       ├── users.js                # NEW
│       └── receipts.js             # NEW
├── routes/
│   ├── webhook.js                  # NEW (extracted from index.js in PR 3)
│   ├── scanReceipt.js              # NEW (extracted from index.js in PR 3)
│   └── receipts.js                 # NEW (read endpoints)
└── tests/
    ├── setup.js                    # NEW: testcontainers jest setup
    ├── helpers/
    │   └── firebaseMock.js         # NEW: mock firebase-admin
    ├── repositories/
    │   ├── users.test.js           # NEW
    │   └── receipts.test.js        # NEW
    └── routes/
        ├── scan-receipt.test.js    # NEW
        └── receipts.test.js        # NEW

smart_business/firestore.rules      # DELETE in PR 3
```

---

# PR 1 — Foundation (Plumbing)

Goal: docker-compose, Knex setup, MinIO wrapper, auth middleware, repository functions with tests. No behavior change to existing endpoints yet.

---

## Task 1: Install dependencies

**Files:**
- Modify: `smart_business/server/package.json`

- [ ] **Step 1: Add runtime dependencies**

Run from `smart_business/server/`:

```bash
npm install knex@^3 pg@^8 minio@^8
```

- [ ] **Step 2: Add dev dependencies**

```bash
npm install --save-dev jest@^29 supertest@^7 testcontainers@^10 @testcontainers/postgresql@^10
```

- [ ] **Step 3: Verify package.json**

Read `smart_business/server/package.json`. The `dependencies` and `devDependencies` sections should now include knex, pg, minio, jest, supertest, testcontainers, and @testcontainers/postgresql.

- [ ] **Step 4: Add test scripts**

Modify `smart_business/server/package.json` to add scripts:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "migrate:make": "knex migrate:make"
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner
git add smart_business/server/package.json smart_business/server/package-lock.json
git commit -m "chore: add knex, pg, minio, jest, testcontainers dependencies"
```

---

## Task 2: Configure Jest with testcontainers setup

**Files:**
- Create: `smart_business/server/jest.config.js`
- Create: `smart_business/server/tests/setup.js`

- [ ] **Step 1: Create jest.config.js**

Write `smart_business/server/jest.config.js`:

```js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 60000,
  clearMocks: true,
};
```

- [ ] **Step 2: Create test setup file**

Write `smart_business/server/tests/setup.js`:

```js
const { PostgreSqlContainer } = require("@testcontainers/postgresql");

let pgContainer;
let knexInstance;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = pgContainer.getConnectionUri();

  knexInstance = require("../db/knex");
  await knexInstance.migrate.latest();

  global.knex = knexInstance;
  global.pgContainer = pgContainer;
});

afterAll(async () => {
  if (knexInstance) await knexInstance.destroy();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (knexInstance) {
    await knexInstance.raw(
      "TRUNCATE users, receipts, receipt_items RESTART IDENTITY CASCADE"
    );
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/jest.config.js smart_business/server/tests/setup.js
git commit -m "test: configure jest with testcontainers postgres setup"
```

---

## Task 3: Create Docker Compose stack

**Files:**
- Create: `smart_business/server/docker-compose.yml`

- [ ] **Step 1: Write docker-compose.yml**

Write `smart_business/server/docker-compose.yml`:

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
      - "5432:5432"

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
      - "9000:9000"
      - "9001:9001"

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

- [ ] **Step 2: Commit**

```bash
git add smart_business/server/docker-compose.yml
git commit -m "infra: add docker-compose with postgres, minio, server services"
```

---

## Task 4: Create Dockerfile

**Files:**
- Create: `smart_business/server/Dockerfile`
- Create: `smart_business/server/.dockerignore`

- [ ] **Step 1: Write Dockerfile**

Write `smart_business/server/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["sh", "-c", "npx knex migrate:latest && node index.js"]
```

- [ ] **Step 2: Write .dockerignore**

Write `smart_business/server/.dockerignore`:

```
node_modules
tests
jest.config.js
.env
.git
.gitignore
```

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/Dockerfile smart_business/server/.dockerignore
git commit -m "infra: add Dockerfile and .dockerignore for server image"
```

---

## Task 5: Extend .env.example

**Files:**
- Modify: `smart_business/server/.env.example`

- [ ] **Step 1: Read current .env.example**

Read `smart_business/server/.env.example` to confirm current contents (should be `TELEGRAM_BOT_TOKEN=...` and `PORT=3000`).

- [ ] **Step 2: Overwrite with extended version**

Write `smart_business/server/.env.example`:

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
# Optional: set these in production. If not set, server falls back to ./serviceAccountKey.json
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/.env.example
git commit -m "config: extend .env.example with database, minio, firebase vars"
```

---

## Task 6: Create Knex configuration and singleton

**Files:**
- Create: `smart_business/server/db/knexfile.js`
- Create: `smart_business/server/db/knex.js`

- [ ] **Step 1: Create knexfile.js**

Write `smart_business/server/db/knexfile.js`:

```js
require("dotenv").config();

module.exports = {
  development: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: `${__dirname}/migrations`,
      tableName: "knex_migrations",
    },
  },
  production: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: `${__dirname}/migrations`,
      tableName: "knex_migrations",
    },
  },
};
```

- [ ] **Step 2: Create knex.js singleton**

Write `smart_business/server/db/knex.js`:

```js
const knex = require("knex");
const config = require("./knexfile");

const environment = process.env.NODE_ENV || "development";

module.exports = knex(config[environment]);
```

- [ ] **Step 3: Verify Knex can connect (manual)**

This step verifies plumbing. From `smart_business/server/`, start just Postgres:

```bash
docker compose up -d postgres
```

Wait ~10 seconds, then test connection:

```bash
DATABASE_URL=postgresql://receipt_app:change_me_in_prod@localhost:5432/smart_business \
POSTGRES_USER=receipt_app POSTGRES_PASSWORD=change_me_in_prod POSTGRES_DB=smart_business \
docker compose run --rm postgres psql -h postgres -U receipt_app -d smart_business -c '\q'
```

Expected: `psql` exits cleanly with no errors (you may need to type the password). If connection fails, check the env vars and Postgres container logs.

Stop the container:

```bash
docker compose down
```

- [ ] **Step 4: Commit**

```bash
git add smart_business/server/db/knexfile.js smart_business/server/db/knex.js
git commit -m "feat(db): add knex configuration and singleton instance"
```

---

## Task 7: Create initial migration

**Files:**
- Create: `smart_business/server/db/migrations/20260618_init.js`

- [ ] **Step 1: Write the migration**

Write `smart_business/server/db/migrations/20260618_init.js`:

```js
exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable("users", (table) => {
    table.string("firebase_uid", 128).primary();
    table.string("email", 255).notNullable().unique();
    table.string("display_name", 255);
    table.bigInteger("telegram_chat_id").unique();
    table.specificType("link_code", "char(6)");
    table.timestamptz("link_code_expires_at");
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    "CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL"
  );
  await knex.raw(
    "CREATE INDEX idx_users_link_code ON users(link_code) WHERE link_code IS NOT NULL"
  );

  await knex.schema.createTable("receipts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .string("user_id", 128)
      .notNullable()
      .references("firebase_uid")
      .inTable("users")
      .onDelete("CASCADE");
    table.specificType("source", "varchar(32)").notNullable();
    table.bigInteger("telegram_message_id");
    table.string("image_path", 512).notNullable();
    table.text("ocr_raw_text").notNullable().defaultTo("");
    table.string("merchant_name", 255).notNullable().defaultTo("");
    table.bigInteger("total_amount").notNullable().defaultTo(0);
    table.specificType("currency", "char(3)").notNullable().defaultTo("IDR");
    table.date("transaction_date");
    table.string("category", 64).notNullable().defaultTo("other");
    table.specificType("status", "varchar(32)").notNullable().defaultTo("processing");
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamptz("confirmed_at");
  });

  await knex.raw(
    "ALTER TABLE receipts ADD CONSTRAINT receipts_source_check CHECK (source IN ('telegram', 'flutter'))"
  );
  await knex.raw(
    "ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('processing', 'needs_review', 'confirmed', 'rejected'))"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_created ON receipts(user_id, created_at DESC)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_status ON receipts(user_id, status)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_cat_date ON receipts(user_id, category, transaction_date)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_processing ON receipts(created_at) WHERE status = 'processing'"
  );

  await knex.schema.createTable("receipt_items", (table) => {
    table.bigIncrements("id").primary();
    table
      .uuid("receipt_id")
      .notNullable()
      .references("id")
      .inTable("receipts")
      .onDelete("CASCADE");
    table.string("name", 255).notNullable();
    table.integer("qty").notNullable().defaultTo(1);
    table.bigInteger("price").notNullable().defaultTo(0);
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("ALTER TABLE receipt_items ADD CONSTRAINT receipt_items_qty_check CHECK (qty > 0)");
  await knex.raw("CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id)");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("receipt_items");
  await knex.schema.dropTableIfExists("receipts");
  await knex.schema.dropTableIfExists("users");
};
```

- [ ] **Step 2: Verify migration applies cleanly**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
docker compose up -d postgres
sleep 10
DATABASE_URL=postgresql://receipt_app:change_me_in_prod@localhost:5432/smart_business npx knex migrate:latest --cwd .
```

Expected output:

```
Batch 1 run: 1 migrations
```

Verify tables exist:

```bash
docker compose exec postgres psql -U receipt_app -d smart_business -c '\dt'
```

Expected: lists `users`, `receipts`, `receipt_items`, `knex_migrations`.

Cleanup:

```bash
docker compose down
```

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/db/migrations/20260618_init.js
git commit -m "feat(db): add initial migration with users, receipts, receipt_items tables"
```

---

## Task 8: Create lib/firebase.js (Admin SDK initialization)

**Files:**
- Create: `smart_business/server/lib/firebase.js`

- [ ] **Step 1: Write lib/firebase.js**

Write `smart_business/server/lib/firebase.js`:

```js
const admin = require("firebase-admin");

function initFirebase() {
  if (admin.apps.length > 0) return;

  const hasEnvConfig =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (hasEnvConfig) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    const serviceAccount = require("../serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

initFirebase();

module.exports = admin;
```

- [ ] **Step 2: Commit**

```bash
git add smart_business/server/lib/firebase.js
git commit -m "feat(firebase): add Admin SDK init with env var + file fallback"
```

---

## Task 9: Create lib/auth.js (requireAuth middleware)

**Files:**
- Create: `smart_business/server/lib/auth.js`

- [ ] **Step 1: Write lib/auth.js**

Write `smart_business/server/lib/auth.js`:

```js
const admin = require("./firebase");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Missing bearer token" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Invalid token" });
  }
}

module.exports = { requireAuth };
```

- [ ] **Step 2: Commit**

```bash
git add smart_business/server/lib/auth.js
git commit -m "feat(auth): extract requireAuth middleware from /scan-receipt"
```

---

## Task 10: Create lib/repositories/users.js with tests (TDD)

**Files:**
- Create: `smart_business/server/lib/repositories/users.js`
- Create: `smart_business/server/tests/repositories/users.test.js`

- [ ] **Step 1: Write the failing test file**

Write `smart_business/server/tests/repositories/users.test.js`:

```js
const users = require("../../lib/repositories/users");

const TEST_USER = {
  firebase_uid: "firebase-uid-1",
  email: "user1@example.com",
  display_name: "User One",
};

describe("users repository", () => {
  describe("upsertFromFirebase", () => {
    it("creates user when not exists", async () => {
      const result = await users.upsertFromFirebase(TEST_USER);

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.email).toBe("user1@example.com");
      expect(result.display_name).toBe("User One");
      expect(result.created_at).toBeTruthy();
    });

    it("updates email when user already exists", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const result = await users.upsertFromFirebase({
        firebase_uid: "firebase-uid-1",
        email: "new-email@example.com",
      });

      expect(result.email).toBe("new-email@example.com");
    });
  });

  describe("findByTelegramChatId", () => {
    it("returns null when no user matches", async () => {
      const result = await users.findByTelegramChatId(12345);
      expect(result).toBeNull();
    });

    it("returns user when match found", async () => {
      await users.upsertFromFirebase(TEST_USER);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ telegram_chat_id: 12345 });

      const result = await users.findByTelegramChatId(12345);

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.telegram_chat_id).toBe(12345);
    });
  });

  describe("findByLinkCode", () => {
    it("returns null when code does not exist", async () => {
      const result = await users.findByLinkCode("ABC123");
      expect(result).toBeNull();
    });

    it("returns user when code matches and not expired", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const future = new Date(Date.now() + 5 * 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "ABC123", link_code_expires_at: future });

      const result = await users.findByLinkCode("ABC123");

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.link_code).toBe("ABC123");
    });

    it("returns null when code matches but expired", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const past = new Date(Date.now() - 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "OLD123", link_code_expires_at: past });

      const result = await users.findByLinkCode("OLD123");
      expect(result).toBeNull();
    });
  });

  describe("linkTelegram", () => {
    it("sets telegram_chat_id and clears link_code", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const future = new Date(Date.now() + 5 * 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "ABC123", link_code_expires_at: future });

      await users.linkTelegram("firebase-uid-1", 99999);

      const user = await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .first();
      expect(user.telegram_chat_id).toBe(99999);
      expect(user.link_code).toBeNull();
      expect(user.link_code_expires_at).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest tests/repositories/users.test.js
```

Expected: FAIL with error about `../../lib/repositories/users` not found.

- [ ] **Step 3: Write the implementation**

Write `smart_business/server/lib/repositories/users.js`:

```js
const knex = require("../../db/knex");

async function upsertFromFirebase({ firebase_uid, email, display_name }) {
  const [row] = await knex("users")
    .insert({
      firebase_uid,
      email,
      display_name: display_name || null,
    })
    .onConflict("firebase_uid")
    .merge({
      email,
      ...(display_name ? { display_name } : {}),
    })
    .returning("*");
  return row;
}

async function findByTelegramChatId(chatId) {
  const row = await knex("users").where({ telegram_chat_id: chatId }).first();
  return row || null;
}

async function findByLinkCode(code) {
  const row = await knex("users")
    .where({ link_code: code })
    .where("link_code_expires_at", ">", knex.fn.now())
    .first();
  return row || null;
}

async function linkTelegram(firebaseUid, chatId) {
  await knex("users").where({ firebase_uid: firebaseUid }).update({
    telegram_chat_id: chatId,
    link_code: null,
    link_code_expires_at: null,
  });
}

module.exports = {
  upsertFromFirebase,
  findByTelegramChatId,
  findByLinkCode,
  linkTelegram,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/repositories/users.test.js
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/lib/repositories/users.js smart_business/server/tests/repositories/users.test.js
git commit -m "feat(repo): add users repository with upsert, lookup, link functions"
```

---

## Task 11: Create lib/repositories/receipts.js with tests (TDD)

**Files:**
- Create: `smart_business/server/lib/repositories/receipts.js`
- Create: `smart_business/server/tests/repositories/receipts.test.js`

- [ ] **Step 1: Write the failing test file**

Write `smart_business/server/tests/repositories/receipts.test.js`:

```js
const receipts = require("../../lib/repositories/receipts");
const usersRepo = require("../../lib/repositories/users");

const USER_A = { firebase_uid: "uid-a", email: "a@example.com", display_name: "A" };
const USER_B = { firebase_uid: "uid-b", email: "b@example.com", display_name: "B" };

async function seedUsers() {
  await usersRepo.upsertFromFirebase(USER_A);
  await usersRepo.upsertFromFirebase(USER_B);
}

describe("receipts repository", () => {
  beforeEach(async () => {
    await seedUsers();
  });

  describe("create", () => {
    it("inserts receipt and returns the new row", async () => {
      const receipt = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "receipts/uid-a/test.jpg",
      });

      expect(receipt.id).toBeTruthy();
      expect(receipt.user_id).toBe("uid-a");
      expect(receipt.source).toBe("flutter");
      expect(receipt.status).toBe("processing");
      expect(receipt.image_path).toBe("receipts/uid-a/test.jpg");
    });

    it("rejects invalid source", async () => {
      await expect(
        receipts.create({
          user_id: "uid-a",
          source: "fax",
          image_path: "x.jpg",
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates receipt fields and items atomically", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "receipts/uid-a/test.jpg",
      });

      const updated = await receipts.update(created.id, "uid-a", {
        merchant_name: "Indomaret",
        total_amount: 25000,
        status: "needs_review",
        items: [
          { name: "Aqua", qty: 2, price: 5000 },
          { name: "Roti", qty: 1, price: 15000 },
        ],
      });

      expect(updated.merchant_name).toBe("Indomaret");
      expect(updated.total_amount).toBe(25000);
      expect(updated.status).toBe("needs_review");

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.items).toHaveLength(2);
      expect(fetched.items[0].name).toBe("Aqua");
      expect(fetched.items[1].name).toBe("Roti");
    });

    it("replaces existing items on update", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "Item1", qty: 1, price: 1000 }],
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "Item2", qty: 1, price: 2000 }],
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.items).toHaveLength(1);
      expect(fetched.items[0].name).toBe("Item2");
    });

    it("returns null when receipt does not belong to user", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });

      const result = await receipts.update(created.id, "uid-b", {
        merchant_name: "Hacked",
      });

      expect(result).toBeNull();

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.merchant_name).toBe("");
    });
  });

  describe("findByIdForUser", () => {
    it("returns receipt with items for owner", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "X", qty: 1, price: 100 }],
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.id).toBe(created.id);
      expect(fetched.items).toHaveLength(1);
    });

    it("returns null for non-owner", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-b");
      expect(fetched).toBeNull();
    });
  });

  describe("listByUser", () => {
    it("returns only the user's receipts, newest first", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await new Promise((r) => setTimeout(r, 50));
      const r2 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });
      await receipts.create({
        user_id: "uid-b",
        source: "flutter",
        image_path: "b1.jpg",
      });

      const list = await receipts.listByUser("uid-a", {});

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(r2.id);
      expect(list[1].id).toBe(r1.id);
    });

    it("filters by status", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await receipts.update(r1.id, "uid-a", { status: "confirmed" });
      await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });

      const list = await receipts.listByUser("uid-a", { status: "confirmed" });

      expect(list).toHaveLength(1);
      expect(list[0].status).toBe("confirmed");
    });

    it("paginates with limit and page", async () => {
      for (let i = 0; i < 5; i++) {
        await receipts.create({
          user_id: "uid-a",
          source: "flutter",
          image_path: `a${i}.jpg`,
        });
        await new Promise((r) => setTimeout(r, 20));
      }

      const page1 = await receipts.listByUser("uid-a", { page: 1, limit: 2 });
      const page2 = await receipts.listByUser("uid-a", { page: 2, limit: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("findStuckProcessing", () => {
    it("returns only processing receipts", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await receipts.update(r1.id, "uid-a", { status: "confirmed" });
      const r2 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });

      const stuck = await receipts.findStuckProcessing();

      expect(stuck).toHaveLength(1);
      expect(stuck[0].id).toBe(r2.id);
    });
  });

  describe("markStuckAsNeedsReview", () => {
    it("updates all stuck receipts to needs_review", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      const r2 = await receipts.create({
        user_id: "uid-b",
        source: "flutter",
        image_path: "b1.jpg",
      });

      const count = await receipts.markStuckAsNeedsReview();

      expect(count).toBe(2);
      const check1 = await receipts.findByIdForUser(r1.id, "uid-a");
      const check2 = await receipts.findByIdForUser(r2.id, "uid-b");
      expect(check1.status).toBe("needs_review");
      expect(check2.status).toBe("needs_review");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest tests/repositories/receipts.test.js
```

Expected: FAIL with error about `../../lib/repositories/receipts` not found.

- [ ] **Step 3: Write the implementation**

Write `smart_business/server/lib/repositories/receipts.js`:

```js
const knex = require("../../db/knex");

async function create({ user_id, source, image_path, telegram_message_id = null }) {
  const [row] = await knex("receipts")
    .insert({
      user_id,
      source,
      image_path,
      telegram_message_id,
    })
    .returning("*");
  return row;
}

async function findByIdForUser(id, userId) {
  const receipt = await knex("receipts").where({ id, user_id: userId }).first();
  if (!receipt) return null;
  const items = await knex("receipt_items")
    .where({ receipt_id: id })
    .orderBy("id", "asc");
  return { ...receipt, items };
}

async function update(id, userId, updates) {
  return knex.transaction(async (trx) => {
    const { items, ...rest } = updates;

    if (items !== undefined) {
      await trx("receipt_items").where({ receipt_id: id }).del();
      if (items.length > 0) {
        await trx("receipt_items").insert(
          items.map((item) => ({
            receipt_id: id,
            name: item.name,
            qty: item.qty,
            price: item.price,
          }))
        );
      }
    }

    const fieldsToUpdate = { ...rest };
    if (rest.status === "confirmed" && !rest.confirmed_at) {
      fieldsToUpdate.confirmed_at = knex.fn.now();
    }

    const updatedRows = await trx("receipts")
      .where({ id, user_id: userId })
      .update(fieldsToUpdate)
      .returning("*");

    if (updatedRows.length === 0) {
      throw new Error("RECEIPT_NOT_FOUND_OR_NOT_OWNER");
    }
    return updatedRows[0];
  }).catch((err) => {
    if (err.message === "RECEIPT_NOT_FOUND_OR_NOT_OWNER") return null;
    throw err;
  });
}

async function listByUser(userId, { status, category, from, to, page = 1, limit = 20 }) {
  let query = knex("receipts").where({ user_id: userId });
  if (status) query = query.where({ status });
  if (category) query = query.where({ category });
  if (from) query = query.where("transaction_date", ">=", from);
  if (to) query = query.where("transaction_date", "<=", to);
  const offset = (page - 1) * limit;
  return query.orderBy("created_at", "desc").limit(limit).offset(offset);
}

async function findStuckProcessing() {
  return knex("receipts").where({ status: "processing" });
}

async function markStuckAsNeedsReview() {
  return knex("receipts")
    .where({ status: "processing" })
    .update({ status: "needs_review" });
}

module.exports = {
  create,
  findByIdForUser,
  update,
  listByUser,
  findStuckProcessing,
  markStuckAsNeedsReview,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/repositories/receipts.test.js
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/lib/repositories/receipts.js smart_business/server/tests/repositories/receipts.test.js
git commit -m "feat(repo): add receipts repository with CRUD, list, recovery functions"
```

---

## Task 12: Create lib/storage.js (MinIO wrapper) with tests

**Files:**
- Create: `smart_business/server/lib/storage.js`
- Create: `smart_business/server/tests/storage.test.js`

- [ ] **Step 1: Write the failing test file**

Write `smart_business/server/tests/storage.test.js`:

```js
const { MinioContainer } = require("@testcontainers/minio");
const { Client: MinioClient } = require("minio");

let minioContainer;
let adminClient;
let storage;

beforeAll(async () => {
  minioContainer = await new MinioContainer("minio/minio:latest").start();

  const host = minioContainer.getHost();
  const port = minioContainer.getMappedPort(9000);

  process.env.MINIO_ENDPOINT = `http://${host}:${port}`;
  process.env.MINIO_ACCESS_KEY = "minioadmin";
  process.env.MINIO_SECRET_KEY = "minioadmin";
  process.env.MINIO_BUCKET = "test-bucket";

  adminClient = new MinioClient({
    endPoint: host,
    port: port,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
  });
  await adminClient.makeBucket("test-bucket", "us-east-1");

  jest.resetModules();
  storage = require("../lib/storage");
});

afterAll(async () => {
  if (minioContainer) await minioContainer.stop();
});

describe("storage", () => {
  it("uploads and returns a signed url", async () => {
    const buffer = Buffer.from("fake-image-bytes");
    const key = "test/receipt-1.jpg";

    const path = await storage.putObject(key, buffer, "image/jpeg");
    expect(path).toBe(key);

    const url = await storage.getSignedUrl(key, 60);
    expect(url).toContain("test-bucket");
    expect(url).toContain("test%2Freceipt-1.jpg");
    expect(url).toMatch(/^http/);
  });
});
```

- [ ] **Step 2: Add @testcontainers/minio dependency**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npm install --save-dev @testcontainers/minio@^10
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tests/storage.test.js
```

Expected: FAIL with error about `../lib/storage` not found.

- [ ] **Step 4: Write the implementation**

Write `smart_business/server/lib/storage.js`:

```js
const { Client: MinioClient } = require("minio");

let clientInstance = null;

function getClient() {
  if (clientInstance) return clientInstance;

  const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";
  const url = new URL(endpoint);

  clientInstance = new MinioClient({
    endPoint: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    useSSL: url.protocol === "https:",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
  return clientInstance;
}

async function putObject(key, buffer, contentType) {
  const bucket = process.env.MINIO_BUCKET;
  const client = getClient();
  await client.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return key;
}

async function getSignedUrl(key, expiresInSeconds = 60) {
  const bucket = process.env.MINIO_BUCKET;
  const client = getClient();
  return client.presignedGetObject(bucket, key, expiresInSeconds);
}

module.exports = { putObject, getSignedUrl, getClient };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest tests/storage.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add smart_business/server/lib/storage.js smart_business/server/tests/storage.test.js smart_business/server/package.json smart_business/server/package-lock.json
git commit -m "feat(storage): add MinIO wrapper for image upload and signed urls"
```

---

## Task 13: End-to-end PR 1 smoke test

**Files:** (no code changes; verification only)

- [ ] **Step 1: Start full stack via docker-compose**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
cp .env.example .env  # if .env doesn't exist yet
# Edit .env: set TELEGRAM_BOT_TOKEN to existing value from current dev env
docker compose up -d
```

Wait ~30 seconds for all services to start.

- [ ] **Step 2: Verify services are healthy**

```bash
docker compose ps
```

Expected: postgres, minio, createbucket all show healthy/exited (0), server shows "running".

- [ ] **Step 3: Verify server started and migrated**

```bash
docker compose logs server | tail -20
```

Expected: logs include "Batch 1 run: 1 migrations" and "Server running on port 3000".

- [ ] **Step 4: Verify existing endpoints still work (no behavior change)**

```bash
curl -s http://localhost:3000/
```

Expected: response body contains "Smart Business Receipt Scanner server is running."

- [ ] **Step 5: Verify all existing tests still pass**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest
```

Expected: all tests pass (no regressions because index.js is unchanged).

- [ ] **Step 6: Stop containers**

```bash
docker compose down
```

- [ ] **Step 7: Mark PR 1 complete (no commit needed)**

PR 1 is now complete. The codebase has all the plumbing for PostgreSQL + MinIO + Knex, but existing endpoints in `index.js` still use Firestore. PR 2 will switch the write paths.

---

# PR 2 — Switch Write Path

Goal: All write operations (Telegram webhook, /scan-receipt, recoverStuckProcessing) move from Firestore to PostgreSQL + MinIO. Reads not yet wired up for mobile polling.

---

## Task 14: Refactor index.js to use Firebase init from lib/firebase.js

**Files:**
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Read current index.js**

Read `smart_business/server/index.js` lines 1-12 to confirm current Firebase init pattern:

```js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore();
```

- [ ] **Step 2: Replace Firebase init in index.js**

Edit `smart_business/server/index.js`. Replace lines 4-11 (the firebase-admin imports and init block) with:

```js
const admin = require("./lib/firebase");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");
const db = getFirestore();
```

Note: `getFirestore` and `Timestamp` stay for now — they'll be removed in PR 3 once all Firestore calls are migrated.

- [ ] **Step 3: Verify index.js still runs**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -e "require('./index.js')" &
sleep 3
kill %1
```

Expected: server starts without errors (look for "Server running on port 3000").

- [ ] **Step 4: Commit**

```bash
git add smart_business/server/index.js
git commit -m "refactor: use lib/firebase.js for Admin SDK init"
```

---

## Task 15: Switch user lookups in /webhook to users repository

**Files:**
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Read the existing helper functions**

Read `smart_business/server/index.js` lines 32-117 to see `findUserByTelegramChatId`, `handleStart`, `handleLink`, `handleStatus`.

- [ ] **Step 2: Replace findUserByTelegramChatId**

Edit `smart_business/server/index.js`. Replace the existing `findUserByTelegramChatId` function (around lines 32-40) with:

```js
const usersRepo = require("./lib/repositories/users");

async function findUserByTelegramChatId(chatId) {
  return await usersRepo.findByTelegramChatId(chatId);
}
```

- [ ] **Step 3: Replace handleLink**

Edit `smart_business/server/index.js`. Replace the existing `handleLink` function (around lines 59-100) with:

```js
async function handleLink(chatId, code) {
  const user = await usersRepo.findByLinkCode(code);

  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Invalid or expired code. Please open the Smart Business app and generate a new link code.",
    );
    return;
  }

  if (user.telegram_chat_id) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "This account is already linked to a Telegram account.",
    );
    return;
  }

  await usersRepo.linkTelegram(user.firebase_uid, chatId);

  await sendMessage(
    BOT_TOKEN,
    chatId,
    "Account connected! You can now send me receipt and invoice photos.",
  );
}
```

- [ ] **Step 4: Remove Firestore imports no longer used**

In `smart_business/server/index.js`, since user lookups now use the repository, check if `Timestamp` is still used elsewhere (yes — in `handlePhoto` and `processReceiptInBackground`). Leave the `getFirestore`/`Timestamp` import for now; will remove in Task 17/18.

- [ ] **Step 5: Verify index.js runs without syntax errors**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -c index.js
```

Expected: no syntax errors output.

- [ ] **Step 6: Commit**

```bash
git add smart_business/server/index.js
git commit -m "refactor(webhook): switch user lookups to users repository"
```

---

## Task 16: Switch handlePhoto to use receipts repository + MinIO

**Files:**
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Add storage import**

Edit `smart_business/server/index.js`. Add at the top with other requires:

```js
const storage = require("./lib/storage");
const receiptsRepo = require("./lib/repositories/receipts");
const crypto = require("crypto");
```

- [ ] **Step 2: Replace handlePhoto function**

Edit `smart_business/server/index.js`. Replace the existing `handlePhoto` function (around lines 119-197) with:

```js
async function handlePhoto(message) {
  const chatId = message.chat.id;
  const user = await findUserByTelegramChatId(chatId);

  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Please link your account first. Open the Smart Business app and tap Connect Telegram.",
    );
    return;
  }

  const photo = message.photo[message.photo.length - 1];
  const fileId = photo.file_id;

  await sendMessage(BOT_TOKEN, chatId, "Processing your receipt...");

  try {
    const imageUrl = await getFileUrl(BOT_TOKEN, fileId);
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    const receiptId = crypto.randomUUID();
    const imagePath = `receipts/${user.firebase_uid}/${receiptId}.jpg`;

    await storage.putObject(imagePath, imageBuffer, "image/jpeg");

    const receipt = await receiptsRepo.create({
      user_id: user.firebase_uid,
      source: "telegram",
      image_path: imagePath,
      telegram_message_id: message.message_id,
    });

    processReceiptInBackground(receipt.id, user.firebase_uid, imageBuffer).catch((err) =>
      console.error("Background OCR failed:", err)
    );

    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Receipt received! I'll process it and you can review it in the app.",
    );
  } catch (error) {
    console.error("Receipt processing error:", error);
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Something went wrong processing your receipt. Please try again or send a clearer photo.",
    );
  }
}
```

Note: We send a minimal acknowledgment immediately. The OCR processing updates the receipt row in the background. The "Receipt received!" message no longer blocks on OCR (which was a bug — the original code sent the parsed result after OCR completed, but kept the request hanging).

- [ ] **Step 3: Replace processReceiptInBackground**

Edit `smart_business/server/index.js`. Replace the existing `processReceiptInBackground` function (around lines 199-227) with:

```js
async function processReceiptInBackground(receiptId, userId, imageBuffer) {
  try {
    const rawText = await extractText(imageBuffer);
    const parsed = parseReceiptText(rawText);
    const category = categorize(parsed.merchantName, rawText);

    await receiptsRepo.update(receiptId, userId, {
      ocr_raw_text: rawText,
      merchant_name: parsed.merchantName,
      total_amount: parsed.totalAmount,
      transaction_date: parsed.transactionDate
        ? parsed.transactionDate.toISOString().split("T")[0]
        : null,
      category,
      items: parsed.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
      })),
      status: "needs_review",
    });
  } catch (error) {
    console.error(`OCR processing failed for ${receiptId}:`, error);
    try {
      await receiptsRepo.update(receiptId, userId, { status: "needs_review" });
    } catch (updateError) {
      console.error(`Failed to update receipt status after OCR error for ${receiptId}:`, updateError);
    }
  }
}
```

- [ ] **Step 4: Verify index.js has no syntax errors**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -c index.js
```

Expected: no syntax errors.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/index.js
git commit -m "refactor(webhook): switch handlePhoto to MinIO + receipts repository"
```

---

## Task 17: Switch /scan-receipt endpoint to use repositories + MinIO + auth middleware

**Files:**
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Add auth middleware import**

Edit `smart_business/server/index.js`. Add at the top with other requires:

```js
const { requireAuth } = require("./lib/auth");
```

- [ ] **Step 2: Replace /scan-receipt handler**

Edit `smart_business/server/index.js`. Replace the entire `app.post("/scan-receipt", ...)` block (around lines 278-341) with:

```js
app.post(
  "/scan-receipt",
  express.json({ limit: "10mb" }),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ error: "unauthorized", message: "Missing bearer token" });
      }
      const idToken = authHeader.split(" ")[1];

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (e) {
        return res
          .status(401)
          .json({ error: "unauthorized", message: "Invalid token" });
      }

      const { image_base64 } = req.body;
      if (!image_base64 || typeof image_base64 !== "string") {
        return res.status(400).json({
          error: "bad_request",
          message: "image_base64 required",
        });
      }

      const uid = decoded.uid;

      await usersRepo.upsertFromFirebase({
        firebase_uid: uid,
        email: decoded.email,
      });

      const imageBuffer = Buffer.from(image_base64, "base64");
      const receiptId = crypto.randomUUID();
      const imagePath = `receipts/${uid}/${receiptId}.jpg`;

      await storage.putObject(imagePath, imageBuffer, "image/jpeg");

      const receipt = await receiptsRepo.create({
        user_id: uid,
        source: "flutter",
        image_path: imagePath,
      });

      res.status(200).json({ receipt_id: receipt.id, status: "processing" });

      processReceiptInBackground(receipt.id, uid, imageBuffer).catch((err) =>
        console.error("Background OCR failed:", err)
      );
    } catch (error) {
      console.error("Scan receipt error:", error);
      res.status(500).json({ error: "internal" });
    }
  }
);
```

Note: We inline the auth check here for now (preserving existing behavior). Task 19 will swap to `requireAuth` middleware when we extract routes. We also call `usersRepo.upsertFromFirebase` to ensure the user row exists for the FK constraint.

- [ ] **Step 3: Verify index.js has no syntax errors**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -c index.js
```

Expected: no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add smart_business/server/index.js
git commit -m "refactor(scan-receipt): switch to MinIO + receipts repository, upsert user"
```

---

## Task 18: Switch recoverStuckProcessingReceipts to use repository

**Files:**
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Replace recoverStuckProcessingReceipts**

Edit `smart_business/server/index.js`. Replace the entire `recoverStuckProcessingReceipts` function (around lines 354-370) with:

```js
async function recoverStuckProcessingReceipts() {
  const count = await receiptsRepo.markStuckAsNeedsReview();
  if (count > 0) {
    console.log(`Recovered ${count} stuck receipts`);
  } else {
    console.log("No stuck receipts to recover");
  }
}
```

- [ ] **Step 2: Verify index.js runs**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -c index.js
```

Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/index.js
git commit -m "refactor: switch recoverStuckProcessing to receipts repository"
```

---

## Task 19: Integration test for /scan-receipt

**Files:**
- Create: `smart_business/server/tests/routes/scan-receipt.test.js`
- Create: `smart_business/server/tests/helpers/firebaseMock.js`
- Modify: `smart_business/server/index.js`

- [ ] **Step 1: Create firebase mock helper**

Write `smart_business/server/tests/helpers/firebaseMock.js`:

```js
function mockFirebaseAdmin({ uid = "test-uid-1", email = "test@example.com" } = {}) {
  const verifyIdToken = jest.fn().mockResolvedValue({ uid, email });
  jest.doMock("../../lib/firebase", () => ({
    auth: () => ({ verifyIdToken }),
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
  }));
  return { verifyIdToken, uid, email };
}

module.exports = { mockFirebaseAdmin };
```

- [ ] **Step 2: Guard app.listen in test environment**

Edit `smart_business/server/index.js`. Replace the `app.listen` block at the bottom (around line 374) with:

```js
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

This prevents port conflicts when integration tests import `index.js`.

- [ ] **Step 3: Write the integration test**

Write `smart_business/server/tests/routes/scan-receipt.test.js`:

```js
const request = require("supertest");

// Mock firebase admin BEFORE requiring index.js
const { mockFirebaseAdmin } = require("../helpers/firebaseMock");
const firebaseMock = mockFirebaseAdmin();

// Mock storage to avoid hitting real MinIO in route tests
jest.mock("../../lib/storage", () => ({
  putObject: jest.fn().mockResolvedValue("mocked/path.jpg"),
  getSignedUrl: jest.fn().mockResolvedValue("http://mocked-url/test"),
}));

describe("POST /scan-receipt", () => {
  let app;

  beforeAll(() => {
    app = require("../../index");
  });

  afterAll(async () => {
    const knex = require("../../db/knex");
    await knex.destroy();
  });

  it("returns 401 when no bearer token", async () => {
    const res = await request(app).post("/scan-receipt").send({ image_base64: "abc" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 401 when token verification fails", async () => {
    firebaseMock.verifyIdToken.mockRejectedValueOnce(new Error("bad token"));

    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer fake-token")
      .send({ image_base64: "abc" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 400 when image_base64 missing", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("returns 200 with receipt_id when valid", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({ image_base64: "aGVsbG8=" }); // "hello" base64

    expect(res.status).toBe(200);
    expect(res.body.receipt_id).toBeTruthy();
    expect(res.body.status).toBe("processing");
  });
});
```

- [ ] **Step 4: Run the test**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest tests/routes/scan-receipt.test.js
```

Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/tests/routes/scan-receipt.test.js smart_business/server/tests/helpers/firebaseMock.js smart_business/server/index.js
git commit -m "test: add integration tests for POST /scan-receipt"
```

---

## Task 20: PR 2 end-to-end smoke test

**Files:** (no code changes; verification only)

- [ ] **Step 1: Start the stack**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
docker compose up -d
sleep 30
```

- [ ] **Step 2: Verify no stuck receipts recovery error**

```bash
docker compose logs server | head -20
```

Expected: log line "No stuck receipts to recover" or "Recovered N stuck receipts". No errors.

- [ ] **Step 3: Manual Telegram test (if webhook is publicly reachable)**

If Telegram webhook is set up (out of scope per spec), send a test photo to the bot. Verify in PostgreSQL:

```bash
docker compose exec postgres psql -U receipt_app -d smart_business -c 'SELECT id, source, status, merchant_name FROM receipts ORDER BY created_at DESC LIMIT 5;'
```

Expected: a row with `source = 'telegram'` and `status` transitioning from `processing` to `needs_review` after OCR.

Verify image in MinIO:

Open MinIO console at http://localhost:9001 (login `minioadmin` / `change_me_in_prod`). Navigate to bucket `receipts`. Confirm an object exists under `receipts/{uid}/`.

- [ ] **Step 4: Verify all tests still pass**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest
```

Expected: all tests pass.

- [ ] **Step 5: Stop stack**

```bash
docker compose down
```

- [ ] **Step 6: Mark PR 2 complete**

PR 2 is now complete. All write paths (Telegram + Flutter) land in PostgreSQL + MinIO. Reads still come from Firestore (but since no mobile code reads yet, this is fine). PR 3 will add read endpoints and remove Firestore.

---

# PR 3 — Switch Read Path + Remove Firestore

Goal: Add read/update endpoints for mobile polling. Extract routes from `index.js`. Remove Firestore imports.

---

## Task 21: Create routes/receipts.js (read + update endpoints) with tests

**Files:**
- Create: `smart_business/server/routes/receipts.js`
- Create: `smart_business/server/tests/routes/receipts.test.js`

- [ ] **Step 1: Write the failing test file**

Write `smart_business/server/tests/routes/receipts.test.js`:

```js
const request = require("supertest");
const express = require("express");
const receiptsRepo = require("../../lib/repositories/receipts");
const usersRepo = require("../../lib/repositories/users");

const { mockFirebaseAdmin } = require("../helpers/firebaseMock");
const firebaseMock = mockFirebaseAdmin();

// Mock storage to avoid hitting real MinIO
jest.mock("../../lib/storage", () => ({
  putObject: jest.fn().mockResolvedValue("mocked/path.jpg"),
  getSignedUrl: jest.fn().mockResolvedValue("http://mocked-url/test"),
}));

const receiptsRouter = require("../../routes/receipts");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/receipts", receiptsRouter);
  return app;
}

const TEST_UID = "test-uid-1";

async function seedReceipt(overrides = {}) {
  await usersRepo.upsertFromFirebase({
    firebase_uid: TEST_UID,
    email: "test@example.com",
  });
  const r = await receiptsRepo.create({
    user_id: TEST_UID,
    source: "flutter",
    image_path: `receipts/${TEST_UID}/${Math.random().toString(36).slice(2)}.jpg`,
    ...overrides,
  });
  return r;
}

describe("routes/receipts", () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  describe("GET /receipts", () => {
    it("returns 401 without auth", async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use("/receipts", receiptsRouter);
      const res = await request(noAuthApp).get("/receipts");
      expect(res.status).toBe(401);
    });

    it("returns list of user's receipts", async () => {
      await seedReceipt();
      await seedReceipt();

      const res = await request(app)
        .get("/receipts")
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it("filters by status", async () => {
      const r1 = await seedReceipt();
      await receiptsRepo.update(r1.id, TEST_UID, { status: "confirmed" });
      await seedReceipt();

      const res = await request(app)
        .get("/receipts?status=confirmed")
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe("confirmed");
    });
  });

  describe("GET /receipts/:id", () => {
    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .get("/receipts/00000000-0000-0000-0000-000000000000")
        .set("Authorization", "Bearer valid");
      expect(res.status).toBe(404);
    });

    it("returns 404 for other user's receipt", async () => {
      const r = await seedReceipt();
      firebaseMock.verifyIdToken.mockResolvedValueOnce({
        uid: "different-uid",
        email: "other@example.com",
      });

      const res = await request(app)
        .get(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(404);
    });

    it("returns receipt with items", async () => {
      const r = await seedReceipt();
      await receiptsRepo.update(r.id, TEST_UID, {
        merchant_name: "Alfamart",
        items: [{ name: "Aqua", qty: 1, price: 5000 }],
      });

      const res = await request(app)
        .get(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(r.id);
      expect(res.body.merchant_name).toBe("Alfamart");
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe("Aqua");
    });
  });

  describe("PATCH /receipts/:id", () => {
    it("updates receipt fields", async () => {
      const r = await seedReceipt();

      const res = await request(app)
        .patch(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid")
        .send({ merchant_name: "Indomaret", total_amount: 15000 });

      expect(res.status).toBe(200);
      expect(res.body.merchant_name).toBe("Indomaret");
      expect(res.body.total_amount).toBe(15000);
    });

    it("confirms receipt and sets confirmed_at", async () => {
      const r = await seedReceipt();
      await receiptsRepo.update(r.id, TEST_UID, { status: "needs_review" });

      const res = await request(app)
        .patch(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid")
        .send({ status: "confirmed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("confirmed");
      expect(res.body.confirmed_at).toBeTruthy();
    });

    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .patch("/receipts/00000000-0000-0000-0000-000000000000")
        .set("Authorization", "Bearer valid")
        .send({ merchant_name: "X" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /receipts/:id/image", () => {
    it("redirects to signed url", async () => {
      const r = await seedReceipt();

      const res = await request(app)
        .get(`/receipts/${r.id}/image`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(302);
      expect(res.headers.location).toBeTruthy();
    });

    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .get("/receipts/00000000-0000-0000-0000-000000000000/image")
        .set("Authorization", "Bearer valid");
      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest tests/routes/receipts.test.js
```

Expected: FAIL with error about `../../routes/receipts` not found.

- [ ] **Step 3: Write the implementation**

Write `smart_business/server/routes/receipts.js`:

```js
const express = require("express");
const { requireAuth } = require("../lib/auth");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { status, category, from, to, page, limit } = req.query;
    const list = await receiptsRepo.listByUser(req.user.uid, {
      status,
      category,
      from,
      to,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json(list);
  } catch (err) {
    console.error("GET /receipts error:", err);
    res.status(500).json({ error: "internal" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const receipt = await receiptsRepo.findByIdForUser(req.params.id, req.user.uid);
    if (!receipt) return res.status(404).json({ error: "not_found" });
    res.json(receipt);
  } catch (err) {
    console.error("GET /receipts/:id error:", err);
    res.status(500).json({ error: "internal" });
  }
});

router.patch("/:id", express.json(), async (req, res) => {
  try {
    const allowedFields = [
      "merchant_name",
      "total_amount",
      "transaction_date",
      "category",
      "status",
      "currency",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "bad_request", message: "No valid fields to update" });
    }

    const updated = await receiptsRepo.update(req.params.id, req.user.uid, updates);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  } catch (err) {
    console.error("PATCH /receipts/:id error:", err);
    res.status(500).json({ error: "internal" });
  }
});

router.get("/:id/image", async (req, res) => {
  try {
    const receipt = await receiptsRepo.findByIdForUser(req.params.id, req.user.uid);
    if (!receipt) return res.status(404).json({ error: "not_found" });
    const url = await storage.getSignedUrl(receipt.image_path, 60);
    res.redirect(302, url);
  } catch (err) {
    console.error("GET /receipts/:id/image error:", err);
    res.status(500).json({ error: "internal" });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/routes/receipts.test.js
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/routes/receipts.js smart_business/server/tests/routes/receipts.test.js
git commit -m "feat(routes): add /receipts endpoints (list, detail, update, image)"
```

---

## Task 22: Extract routes/webhook.js

**Files:**
- Create: `smart_business/server/routes/webhook.js`

- [ ] **Step 1: Write routes/webhook.js**

Write `smart_business/server/routes/webhook.js`:

```js
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const { sendMessage, getFileUrl } = require("../lib/telegram");
const { extractText } = require("../lib/ocr");
const { parseReceiptText } = require("../lib/parser");
const { categorize } = require("../lib/categorizer");
const usersRepo = require("../lib/repositories/users");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");

const router = express.Router();

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

async function findUserByTelegramChatId(chatId) {
  return usersRepo.findByTelegramChatId(chatId);
}

async function handleStart(BOT_TOKEN, chatId) {
  await sendMessage(
    BOT_TOKEN,
    chatId,
    "Welcome to Smart Business Receipt Scanner!\n\n" +
      "I'll scan your receipt and invoice photos.\n\n" +
      "To get started:\n" +
      "1. Open the Smart Business app\n" +
      '2. Tap "Connect Telegram"\n' +
      "3. Send the link code here with /link <code>\n\n" +
      "Commands:\n" +
      "/link <code> — Connect your account\n" +
      "/help — Show this message\n" +
      "/status — Check connection status"
  );
}

async function handleLink(BOT_TOKEN, chatId, code) {
  const user = await usersRepo.findByLinkCode(code);
  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Invalid or expired code. Please open the Smart Business app and generate a new link code."
    );
    return;
  }
  if (user.telegram_chat_id) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "This account is already linked to a Telegram account."
    );
    return;
  }
  await usersRepo.linkTelegram(user.firebase_uid, chatId);
  await sendMessage(
    BOT_TOKEN,
    chatId,
    "Account connected! You can now send me receipt and invoice photos."
  );
}

async function handleStatus(BOT_TOKEN, chatId) {
  const user = await findUserByTelegramChatId(chatId);
  if (!user) {
    await sendMessage(BOT_TOKEN, chatId, "No account linked. Send /link <code> to connect.");
  } else {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      `Account linked to: ${user.email || user.display_name}`
    );
  }
}

async function processReceiptInBackground(receiptId, userId, imageBuffer) {
  try {
    const rawText = await extractText(imageBuffer);
    const parsed = parseReceiptText(rawText);
    const category = categorize(parsed.merchantName, rawText);

    await receiptsRepo.update(receiptId, userId, {
      ocr_raw_text: rawText,
      merchant_name: parsed.merchantName,
      total_amount: parsed.totalAmount,
      transaction_date: parsed.transactionDate
        ? parsed.transactionDate.toISOString().split("T")[0]
        : null,
      category,
      items: parsed.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
      })),
      status: "needs_review",
    });
  } catch (error) {
    console.error(`OCR processing failed for ${receiptId}:`, error);
    try {
      await receiptsRepo.update(receiptId, userId, { status: "needs_review" });
    } catch (updateError) {
      console.error(`Failed to update receipt status after OCR error for ${receiptId}:`, updateError);
    }
  }
}

async function handlePhoto(BOT_TOKEN, message) {
  const chatId = message.chat.id;
  const user = await findUserByTelegramChatId(chatId);

  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Please link your account first. Open the Smart Business app and tap Connect Telegram."
    );
    return;
  }

  const photo = message.photo[message.photo.length - 1];
  const fileId = photo.file_id;

  await sendMessage(BOT_TOKEN, chatId, "Processing your receipt...");

  try {
    const imageUrl = await getFileUrl(BOT_TOKEN, fileId);
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(imageResponse.data);

    const receiptId = crypto.randomUUID();
    const imagePath = `receipts/${user.firebase_uid}/${receiptId}.jpg`;
    await storage.putObject(imagePath, imageBuffer, "image/jpeg");

    const receipt = await receiptsRepo.create({
      user_id: user.firebase_uid,
      source: "telegram",
      image_path: imagePath,
      telegram_message_id: message.message_id,
    });

    processReceiptInBackground(receipt.id, user.firebase_uid, imageBuffer).catch((err) =>
      console.error("Background OCR failed:", err)
    );

    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Receipt received! I'll process it and you can review it in the app."
    );
  } catch (error) {
    console.error("Receipt processing error:", error);
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Something went wrong processing your receipt. Please try again or send a clearer photo."
    );
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

router.post("/", express.json(), async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) {
      return res.status(200).send("No message");
    }

    const text = message.text || "";
    const chatId = message.chat.id;

    if (text.startsWith("/start")) {
      await handleStart(BOT_TOKEN, chatId);
    } else if (text.startsWith("/link")) {
      const code = text.split(" ")[1]?.trim();
      if (!code) {
        await sendMessage(
          BOT_TOKEN,
          chatId,
          "Usage: /link <code>\nGenerate a code in the Smart Business app."
        );
      } else {
        await handleLink(BOT_TOKEN, chatId, code);
      }
    } else if (text.startsWith("/help")) {
      await handleStart(BOT_TOKEN, chatId);
    } else if (text.startsWith("/status")) {
      await handleStatus(BOT_TOKEN, chatId);
    } else if (message.photo) {
      await handlePhoto(BOT_TOKEN, message);
    } else {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "Send me a receipt photo or type /help for commands."
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Internal error");
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add smart_business/server/routes/webhook.js
git commit -m "refactor: extract telegram webhook handler into routes/webhook.js"
```

---

## Task 23: Extract routes/scanReceipt.js

**Files:**
- Create: `smart_business/server/routes/scanReceipt.js`

- [ ] **Step 1: Write routes/scanReceipt.js**

Write `smart_business/server/routes/scanReceipt.js`:

```js
const express = require("express");
const crypto = require("crypto");

const admin = require("../lib/firebase");
const { requireAuth } = require("../lib/auth");
const usersRepo = require("../lib/repositories/users");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");
const { extractText } = require("../lib/ocr");
const { parseReceiptText } = require("../lib/parser");
const { categorize } = require("../lib/categorizer");

const router = express.Router();

async function processReceiptInBackground(receiptId, userId, imageBuffer) {
  try {
    const rawText = await extractText(imageBuffer);
    const parsed = parseReceiptText(rawText);
    const category = categorize(parsed.merchantName, rawText);

    await receiptsRepo.update(receiptId, userId, {
      ocr_raw_text: rawText,
      merchant_name: parsed.merchantName,
      total_amount: parsed.totalAmount,
      transaction_date: parsed.transactionDate
        ? parsed.transactionDate.toISOString().split("T")[0]
        : null,
      category,
      items: parsed.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price,
      })),
      status: "needs_review",
    });
  } catch (error) {
    console.error(`OCR processing failed for ${receiptId}:`, error);
    try {
      await receiptsRepo.update(receiptId, userId, { status: "needs_review" });
    } catch (updateError) {
      console.error(`Failed to update receipt status after OCR error for ${receiptId}:`, updateError);
    }
  }
}

router.post(
  "/",
  express.json({ limit: "10mb" }),
  requireAuth,
  async (req, res) => {
    try {
      const { image_base64 } = req.body;
      if (!image_base64 || typeof image_base64 !== "string") {
        return res.status(400).json({
          error: "bad_request",
          message: "image_base64 required",
        });
      }

      await usersRepo.upsertFromFirebase({
        firebase_uid: req.user.uid,
        email: req.user.email,
      });

      const imageBuffer = Buffer.from(image_base64, "base64");
      const receiptId = crypto.randomUUID();
      const imagePath = `receipts/${req.user.uid}/${receiptId}.jpg`;
      await storage.putObject(imagePath, imageBuffer, "image/jpeg");

      const receipt = await receiptsRepo.create({
        user_id: req.user.uid,
        source: "flutter",
        image_path: imagePath,
      });

      res.status(200).json({ receipt_id: receipt.id, status: "processing" });

      processReceiptInBackground(receipt.id, req.user.uid, imageBuffer).catch((err) =>
        console.error("Background OCR failed:", err)
      );
    } catch (error) {
      console.error("Scan receipt error:", error);
      res.status(500).json({ error: "internal" });
    }
  }
);

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add smart_business/server/routes/scanReceipt.js
git commit -m "refactor: extract /scan-receipt handler into routes/scanReceipt.js"
```

---

## Task 24: Rewrite index.js to slim version (remove Firestore)

**Files:**
- Modify: `smart_business/server/index.js`
- Modify: `smart_business/server/tests/routes/scan-receipt.test.js`

- [ ] **Step 1: Overwrite index.js with slim version**

Write `smart_business/server/index.js`:

```js
require("dotenv").config();
const express = require("express");
const receiptsRepo = require("./lib/repositories/receipts");

const webhookRoutes = require("./routes/webhook");
const scanReceiptRoutes = require("./routes/scanReceipt");
const receiptsRoutes = require("./routes/receipts");

const PORT = process.env.PORT || 3000;

const app = express();

app.use("/webhook", webhookRoutes);
app.use("/scan-receipt", scanReceiptRoutes);
app.use("/receipts", receiptsRoutes);

app.get("/", (req, res) => {
  res.send("Smart Business Receipt Scanner server is running.");
});

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "payload_too_large" });
  }
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "bad_request", message: "Invalid JSON" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal" });
});

async function recoverStuckProcessingReceipts() {
  const count = await receiptsRepo.markStuckAsNeedsReview();
  if (count > 0) {
    console.log(`Recovered ${count} stuck receipts`);
  } else {
    console.log("No stuck receipts to recover");
  }
}

recoverStuckProcessingReceipts().catch(console.error);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 2: Verify all files have no syntax errors**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
node -c index.js
node -c routes/webhook.js
node -c routes/scanReceipt.js
node -c routes/receipts.js
```

Expected: all syntax-check OK with no output.

- [ ] **Step 3: Update scan-receipt test to use index.js app export (no inline auth)**

Edit `smart_business/server/tests/routes/scan-receipt.test.js`. Replace the entire file content with:

```js
const request = require("supertest");

// Mock firebase admin BEFORE requiring app
const { mockFirebaseAdmin } = require("../helpers/firebaseMock");
const firebaseMock = mockFirebaseAdmin();

// Mock storage
jest.mock("../../lib/storage", () => ({
  putObject: jest.fn().mockResolvedValue("mocked/path.jpg"),
  getSignedUrl: jest.fn().mockResolvedValue("http://mocked-url/test"),
}));

const app = require("../../index");

afterAll(async () => {
  const knex = require("../../db/knex");
  await knex.destroy();
});

describe("POST /scan-receipt", () => {
  it("returns 401 when no bearer token", async () => {
    const res = await request(app).post("/scan-receipt").send({ image_base64: "abc" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 401 when token verification fails", async () => {
    firebaseMock.verifyIdToken.mockRejectedValueOnce(new Error("bad token"));
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer fake-token")
      .send({ image_base64: "abc" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when image_base64 missing", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("returns 200 with receipt_id when valid", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({ image_base64: "aGVsbG8=" });
    expect(res.status).toBe(200);
    expect(res.body.receipt_id).toBeTruthy();
    expect(res.body.status).toBe("processing");
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/index.js smart_business/server/tests/routes/scan-receipt.test.js
git commit -m "refactor: slim index.js to route registration, remove Firestore imports"
```

---

## Task 25: Delete firestore.rules and verify Firestore fully removed

**Files:**
- Delete: `smart_business/firestore.rules`

- [ ] **Step 1: Confirm no Firestore imports remain**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
grep -rn "firebase-admin/firestore\|getFirestore\|collection(\|\.doc(\|\.set(\|\.update(\|collectionGroup" --include="*.js" lib/ routes/ index.js 2>/dev/null
```

Expected: no output (no matches). If matches remain, fix them before continuing.

- [ ] **Step 2: Delete firestore.rules**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner
rm smart_business/firestore.rules
```

- [ ] **Step 3: Commit**

```bash
git add -A smart_business/firestore.rules
git commit -m "chore: remove firestore.rules (Firestore fully decommissioned)"
```

---

## Task 26: Final end-to-end smoke test

**Files:** (no code changes; final verification)

- [ ] **Step 1: Start the full stack**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
docker compose up -d --build
sleep 30
```

- [ ] **Step 2: Verify all services are healthy**

```bash
docker compose ps
```

Expected: postgres, minio healthy; createbucket exited 0; server running.

- [ ] **Step 3: Verify server logs**

```bash
docker compose logs server | tail -30
```

Expected: contains "Batch 1 run: 1 migrations", "No stuck receipts to recover" (or recovery count), "Server running on port 3000". No errors.

- [ ] **Step 4: Verify root endpoint**

```bash
curl -s http://localhost:3000/
```

Expected: "Smart Business Receipt Scanner server is running."

- [ ] **Step 5: Verify /receipts requires auth**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/receipts
```

Expected: `401`.

- [ ] **Step 6: Run all automated tests one more time**

```bash
cd /Users/rizkiautentika/RIZKI/receipt-scanner/smart_business/server
npx jest
```

Expected: all tests pass.

- [ ] **Step 7: Manual end-to-end test (optional but recommended)**

Use `curl` with a valid Firebase Auth token (from a signed-in mobile user or test user):

```bash
TOKEN="<paste-a-valid-firebase-id-token>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/receipts
```

Expected: `[]` (empty list if no receipts yet).

- [ ] **Step 8: Stop stack**

```bash
docker compose down
```

- [ ] **Step 9: Mark PR 3 complete**

PR 3 is complete. Firestore is fully removed. Backend now uses PostgreSQL + MinIO exclusively. Firebase Auth is still used via `lib/firebase.js`.

---

## Appendix A: Package Versions Used

These versions are known to work as of plan creation (June 2026). Use latest patch within same major unless noted.

**Runtime dependencies:**
- `knex` ^3.0.0
- `pg` ^8.0.0
- `minio` ^8.0.0
- `firebase-admin` ^14.0.0 (already installed)

**Dev dependencies:**
- `jest` ^29.0.0
- `supertest` ^7.0.0
- `testcontainers` ^10.0.0
- `@testcontainers/postgresql` ^10.0.0
- `@testcontainers/minio` ^10.0.0

## Appendix B: Mobile Integration Notes (Out of Scope)

This plan covers backend only. Mobile Flutter app needs separate work:

1. Add `firebase_auth` package to `mobile_receipt_scanner/pubspec.yaml`
2. Implement sign-in UI (email/password or OAuth)
3. Get ID token after sign-in: `await user.getIdToken()`
4. Attach token as `Authorization: Bearer <token>` to all `/receipts` and `/scan-receipt` calls
5. Implement receipt list page that polls `GET /receipts` (or use pull-to-refresh)
6. Implement receipt detail page that polls `GET /receipts/:id` every 3s while status is `processing`
7. Implement image preview using `GET /receipts/:id/image` redirect URL

This work is tracked separately per spec's "Out of Scope" section.

## Appendix C: Rollback Notes

If rollback is needed mid-migration:

- **After PR 1 (Foundation):** No behavior change. Safe to revert PR 1 alone; just removes new files.
- **After PR 2 (Write path):** New writes go to PG. Reverting PR 2 means writes go back to Firestore, but receipts written between PR 2 merge and rollback are in PG only. Acceptable for dev (no production data per spec).
- **After PR 3 (Read path + remove Firestore):** Firestore fully removed. Rollback requires re-adding Firestore code. Data since PR 2 merge lives in PG. Acceptable for dev.

For production (future): before PR 2, snapshot both Firestore (export) and skip ahead to PG. After PR 3, can disable Firestore in Firebase Console.
