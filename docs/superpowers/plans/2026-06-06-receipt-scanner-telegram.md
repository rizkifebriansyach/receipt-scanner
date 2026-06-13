# Smart Business Receipt Scanner — Telegram Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a receipt/invoice scanner where solo business owners send photos via Telegram bot, data is processed by a local Node.js server, and managed through a Flutter dashboard app.

**Architecture:** Telegram Bot sends photos via webhook to a local Express.js server (exposed via ngrok). The server runs Tesseract.js OCR, parses text, stores results + base64 image in Firestore. Flutter app reads Firestore to display dashboard, receipt management, and reports. Everything runs on Firebase Spark (free) plan — no Cloud Functions, no Cloud Storage.

**Tech Stack (Backend):** Firebase (Auth, Firestore — free Spark plan), Express.js + ngrok, Tesseract.js, Node.js

**Tech Stack (Flutter):** Flutter 3.x, **Clean Architecture** (domain/data/presentation layers), **BLoC** (flutter_bloc + equatable), **get_it** (dependency injection), GoRouter, fl_chart, intl

---

## Clean Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  PRESENTATION LAYER (Flutter UI)                │
│  Screens, Widgets, BLoC (Events/States)         │
│  Depends on: Domain                              │
├─────────────────────────────────────────────────┤
│  DOMAIN LAYER (Pure Dart — no Flutter/Firebase)  │
│  Entities, Repository interfaces, Use Cases      │
│  Depends on: Nothing (pure business logic)       │
├─────────────────────────────────────────────────┤
│  DATA LAYER (Firebase implementation)            │
│  Models (DTOs), DataSources, Repository impls    │
│  Depends on: Domain                              │
└─────────────────────────────────────────────────┘
```

**Key principle:** Domain layer has ZERO external dependencies. It defines WHAT the app does. Data layer decides HOW to do it (Firebase). Presentation layer shows it (BLoC + UI).

---

## File Structure

```
smart_business/
├─ server/                         (Phase 1 — already built)
│   ├─ package.json
│   ├─ index.js
│   ├─ lib/
│   │   ├─ telegram.js
│   │   ├─ ocr.js
│   │   ├─ parser.js
│   │   └─ categorizer.js
│   ├─ serviceAccountKey.json
│   └─ .env.example
├─ android/, ios/                  (Flutter generated)
├─ lib/
│   ├─ main.dart                   (App entry, DI setup)
│   ├─ app.dart                    (MaterialApp, GoRouter)
│   │
│   ├─ core/                       # Shared across features
│   │   ├─ errors/
│   │   │   └─ failures.dart       (Failure classes for error handling)
│   │   └─ utils/
│   │       └─ formatters.dart     (CurrencyFormatter, DateFormatter)
│   │
│   ├─ domain/                     # DOMAIN LAYER — pure Dart, no Flutter
│   │   ├─ entities/
│   │   │   ├─ user_entity.dart
│   │   │   └─ receipt_entity.dart
│   │   ├─ repositories/           # Abstract interfaces
│   │   │   ├─ auth_repository.dart
│   │   │   └─ receipt_repository.dart
│   │   └─ usecases/
│   │       ├─ sign_in_usecase.dart
│   │       ├─ sign_up_usecase.dart
│   │       ├─ get_current_user_usecase.dart
│   │       ├─ sign_out_usecase.dart
│   │       ├─ watch_receipts_usecase.dart
│   │       ├─ confirm_receipt_usecase.dart
│   │       ├─ update_receipt_usecase.dart
│   │       ├─ generate_link_code_usecase.dart
│   │       └─ check_telegram_link_usecase.dart
│   │
│   ├─ data/                       # DATA LAYER — Firebase implementation
│   │   ├─ models/                 # DTOs (Data Transfer Objects)
│   │   │   ├─ user_model.dart
│   │   │   └─ receipt_model.dart
│   │   ├─ datasources/
│   │   │   ├─ auth_remote_datasource.dart
│   │   │   └─ receipt_remote_datasource.dart
│   │   └─ repositories/
│   │       ├─ auth_repository_impl.dart
│   │       └─ receipt_repository_impl.dart
│   │
│   ├─ presentation/               # PRESENTATION LAYER — UI + BLoC
│   │   ├─ bloc/
│   │   │   ├─ auth/
│   │   │   │   ├─ auth_bloc.dart
│   │   │   │   ├─ auth_event.dart
│   │   │   │   └─ auth_state.dart
│   │   │   ├─ receipt/
│   │   │   │   ├─ receipt_bloc.dart
│   │   │   │   ├─ receipt_event.dart
│   │   │   │   └─ receipt_state.dart
│   │   │   └─ telegram/
│   │   │       ├─ telegram_bloc.dart
│   │   │       ├─ telegram_event.dart
│   │   │       └─ telegram_state.dart
│   │   ├─ screens/
│   │   │   ├─ login_screen.dart
│   │   │   ├─ home_screen.dart
│   │   │   ├─ receipt_list_screen.dart
│   │   │   ├─ receipt_detail_screen.dart
│   │   │   ├─ reports_screen.dart
│   │   │   ├─ telegram_link_screen.dart
│   │   │   └─ settings_screen.dart
│   │   └─ widgets/
│   │       ├─ summary_card.dart
│   │       ├─ receipt_card.dart
│   │       └─ category_chart.dart
│   │
│   └─ injection.dart              # get_it service locator
│
├─ firestore.rules
└─ pubspec.yaml
```

---

## Phase 1: Firebase Setup & Local Node.js Server

### Task 1: Firebase Project Initialization

**Files:**
- Create: `smart_business/firestore.rules`

- [ ] **Step 1: Create Firebase project**

Go to [Firebase Console](https://console.firebase.google.com), create a new project named `smart-business-receipts`. Enable only:
- Authentication (Email/Password + Google)
- Cloud Firestore

> **Note:** Cloud Storage and Cloud Functions are NOT needed. Receipt images are stored as base64 in Firestore. The backend runs as a local Express.js server. This keeps everything on the free Spark plan.

- [ ] **Step 2: Create project directory**

```bash
mkdir -p smart_business/server/lib
cd smart_business
```

- [ ] **Step 3: Create Firestore security rules**

Create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /receipts/{userId}/items/{receiptId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 4: Generate Firebase Admin SDK service account key**

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Save the downloaded JSON file as `server/serviceAccountKey.json`
4. **Add `serviceAccountKey.json` to `.gitignore` immediately — this file contains secrets!**

- [ ] **Step 5: Initialize server and install dependencies**

```bash
cd server
npm init -y
npm install express firebase-admin tesseract.js axios dotenv
```

- [ ] **Step 6: Create .env.example**

Create `server/.env.example`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
PORT=3000
```

- [ ] **Step 7: Commit**

```bash
git add firestore.rules server/package.json server/.env.example
git commit -m "feat: initialize project with Firebase Firestore rules and Express.js server"
```

---

### Task 2: Telegram Bot API Helpers

**Files:**
- Create: `server/lib/telegram.js`

- [ ] **Step 1: Implement Telegram helper module**

Create `server/lib/telegram.js`:

```javascript
const axios = require("axios");

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotUrl(token) {
  return `${TELEGRAM_API}${token}`;
}

async function sendMessage(token, chatId, text, parseMode = "Markdown") {
  return axios.post(`${getBotUrl(token)}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });
}

async function getFileUrl(token, fileId) {
  const response = await axios.get(`${getBotUrl(token)}/getFile`, {
    params: { file_id: fileId },
  });
  const filePath = response.data.result.file_path;
  return `${TELEGRAM_API}${token}/${filePath}`;
}

module.exports = { sendMessage, getFileUrl, getBotUrl };
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/telegram.js
git commit -m "feat: add Telegram Bot API helper module"
```

---

### Task 3: OCR Module

**Files:**
- Create: `server/lib/ocr.js`

- [ ] **Step 1: Implement Tesseract.js OCR wrapper**

Create `server/lib/ocr.js`:

```javascript
const Tesseract = require("tesseract.js");

async function extractText(imageBuffer) {
  const worker = await Tesseract.createWorker("eng+ind");
  const { data } = await worker.recognize(imageBuffer);
  await worker.terminate();
  return data.text;
}

module.exports = { extractText };
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/ocr.js
git commit -m "feat: add Tesseract.js OCR module"
```

---

### Task 4: Receipt Parser & Categorizer

**Files:**
- Create: `server/lib/parser.js`
- Create: `server/lib/categorizer.js`

- [ ] **Step 1: Implement receipt text parser**

Create `server/lib/parser.js`:

```javascript
function parseReceiptText(rawText) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const merchantName = lines[0] || "Unknown Merchant";

  const amountPatterns = [
    /(?:Rp\.?\s?)([\d.]+(?:,\d{2})?)/gi,
    /(?:TOTAL|Total|total)\s*:?\s*(?:Rp\.?\s?)([\d.]+)/i,
    /(?:TOTAL|Total|total)\s*:?\s*([\d.]+)/i,
  ];

  let totalAmount = 0;
  for (const line of lines) {
    for (const pattern of amountPatterns) {
      const match = pattern.exec(line);
      if (match) {
        const raw = match[1] || match[0].replace(/[^0-9,]/g, "");
        const cleaned = raw.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(cleaned);
        if (num > totalAmount) {
          totalAmount = num;
        }
      }
    }
  }

  let transactionDate = null;
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  for (const line of lines) {
    const match = datePattern.exec(line);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += 2000;
      transactionDate = new Date(year, month, day);
      break;
    }
  }

  const items = [];
  const itemPattern = /^(.+?)\s+(\d+)\s+(?:x\s+)?(?:Rp\.?\s?)([\d.]+)$/i;
  for (const line of lines.slice(1)) {
    const match = itemPattern.exec(line);
    if (match) {
      items.push({
        name: match[1].trim(),
        qty: parseInt(match[2]),
        price: parseFloat(match[3].replace(/\./g, "")),
      });
    }
  }

  return {
    merchantName,
    totalAmount: Math.round(totalAmount),
    transactionDate,
    items,
    rawText,
  };
}

module.exports = { parseReceiptText };
```

- [ ] **Step 2: Implement auto-categorizer**

Create `server/lib/categorizer.js`:

```javascript
const CATEGORY_RULES = [
  { keywords: ["bensin", "pertamax", "solar", "bbm"], category: "transport" },
  { keywords: ["parkir", "tol", "parking"], category: "transport" },
  { keywords: ["beras", "minyak", "gula", "tepung", "telur"], category: "supplies" },
  { keywords: ["makan", "nasi", "ayam", "kopi", "resto", "cafe"], category: "food" },
  { keywords: ["pln", "listrik", "pdam", "air", "internet", "wifi"], category: "utilities" },
  { keywords: ["atk", "kertas", "printer", "toner", "pensil"], category: "office" },
];

function categorize(merchantName, rawText) {
  const text = `${merchantName} ${rawText}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return rule.category;
      }
    }
  }
  return "other";
}

module.exports = { categorize };
```

- [ ] **Step 3: Commit**

```bash
git add server/lib/parser.js server/lib/categorizer.js
git commit -m "feat: add receipt parser and auto-categorizer"
```

---

### Task 5: Express.js Webhook Server

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Implement the main Express.js webhook server**

Create `server/index.js`:

```javascript
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = getFirestore();

const { sendMessage, getFileUrl } = require("./lib/telegram");
const { extractText } = require("./lib/ocr");
const { parseReceiptText } = require("./lib/parser");
const { categorize } = require("./lib/categorizer");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

async function findUserByTelegramChatId(chatId) {
  const snapshot = await db
    .collection("users")
    .where("telegram_chat_id", "==", chatId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function handleStart(chatId) {
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
      "/status — Check connection status",
  );
}

async function handleLink(chatId, code) {
  const now = Timestamp.now();
  const snapshot = await db
    .collection("users")
    .where("link_code", "==", code)
    .where("link_code_expires_at", ">", now)
    .limit(1)
    .get();

  if (snapshot.empty) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Invalid or expired code. Please open the Smart Business app and generate a new link code.",
    );
    return;
  }

  const docRef = snapshot.docs[0].ref;
  const userData = snapshot.docs[0].data();

  if (userData.telegram_chat_id) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "This account is already linked to a Telegram account.",
    );
    return;
  }

  await docRef.update({
    telegram_chat_id: chatId,
    link_code: null,
    link_code_expires_at: null,
  });

  await sendMessage(
    BOT_TOKEN,
    chatId,
    "Account connected! You can now send me receipt and invoice photos.",
  );
}

async function handleStatus(chatId) {
  const user = await findUserByTelegramChatId(chatId);
  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "No account linked. Send /link <code> to connect.",
    );
  } else {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      `Account linked to: ${user.email || user.display_name}`,
    );
  }
}

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

    const imageBase64 = imageBuffer.toString("base64");

    const rawText = await extractText(imageBuffer);

    const parsed = parseReceiptText(rawText);

    const category = categorize(parsed.merchantName, rawText);

    const receiptRef = db
      .collection("receipts")
      .doc(user.uid)
      .collection("items")
      .doc();

    await receiptRef.set({
      telegram_message_id: message.message_id,
      image_base64: imageBase64,
      ocr_raw_text: rawText,
      merchant_name: parsed.merchantName,
      total_amount: parsed.totalAmount,
      currency: "IDR",
      transaction_date: parsed.transactionDate
        ? Timestamp.fromDate(parsed.transactionDate)
        : null,
      category,
      items: parsed.items,
      status: "needs_review",
      created_at: Timestamp.now(),
      confirmed_at: null,
    });

    const dateStr = parsed.transactionDate
      ? parsed.transactionDate.toLocaleDateString("id-ID")
      : "unknown date";
    await sendMessage(
      BOT_TOKEN,
      chatId,
      `Receipt received!\n\n` +
        `Merchant: ${parsed.merchantName}\n` +
        `Amount: ${formatCurrency(parsed.totalAmount)}\n` +
        `Date: ${dateStr}\n` +
        `Category: ${category}\n\n` +
        `Please review and confirm in the app.`,
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

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) {
      res.status(200).send("No message");
      return;
    }

    const text = message.text || "";
    const chatId = message.chat.id;

    if (text.startsWith("/start")) {
      await handleStart(chatId);
    } else if (text.startsWith("/link")) {
      const code = text.split(" ")[1]?.trim();
      if (!code) {
        await sendMessage(
          BOT_TOKEN,
          chatId,
          "Usage: /link <code>\nGenerate a code in the Smart Business app.",
        );
      } else {
        await handleLink(chatId, code);
      }
    } else if (text.startsWith("/help")) {
      await handleStart(chatId);
    } else if (text.startsWith("/status")) {
      await handleStatus(chatId);
    } else if (message.photo) {
      await handlePhoto(message);
    } else {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        'Send me a receipt photo or type /help for commands.',
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Internal error");
  }
});

app.get("/", (req, res) => {
  res.send("Smart Business Receipt Scanner server is running.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: add Express.js webhook server with Telegram message routing"
```

---

### Task 6: Run Server & Register Telegram Bot

- [ ] **Step 1: Register Telegram bot via BotFather**

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Choose a display name: `Smart Business Scanner`
4. Choose a username: `smart_business_<yourname>_bot`
5. Copy the bot token

- [ ] **Step 2: Set up .env**

```bash
cd smart_business/server
cp .env.example .env
# Edit .env and paste your bot token
```

- [ ] **Step 3: Install ngrok (if not already installed)**

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

- [ ] **Step 4: Start the server**

```bash
cd smart_business/server
node index.js
```

Server starts on `http://localhost:3000`.

- [ ] **Step 5: Expose server to internet with ngrok**

In a new terminal:

```bash
ngrok http 3000
```

ngrok gives you a URL like `https://abc123.ngrok-free.app`. Keep this terminal open.

- [ ] **Step 6: Set the Telegram webhook**

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://abc123.ngrok-free.app/webhook"
```

> **Note:** Each time you restart ngrok, the URL changes. Re-run the setWebhook command with the new URL.

- [ ] **Step 7: Test the bot on Telegram**

Open Telegram, find your bot, send `/start`. You should get the welcome message.

---

## Phase 2: Flutter App — Clean Architecture + BLoC

### Task 7: Flutter Project Setup & Dependencies

- [ ] **Step 1: Create Flutter project**

```bash
cd smart_business
flutter create --org com.smartbusiness --project-name smart_business .
```

- [ ] **Step 2: Install dependencies**

```bash
# Firebase (no firebase_storage — images are base64 in Firestore)
flutter pub add firebase_core firebase_auth cloud_firestore

# BLoC
flutter pub add flutter_bloc equatable

# Dependency Injection
flutter pub add get_it

# Navigation
flutter pub add go_router

# Charts & Utilities
flutter pub add fl_chart intl

# Sharing / Export
flutter pub add share_plus path_provider
```

- [ ] **Step 3: Configure Firebase for Flutter**

```bash
dart pub global activate flutterfire_cli
flutterfire configure
# Select the smart-business-receipts project
# Select both iOS and Android platforms
```

This generates `lib/firebase_options.dart`.

- [ ] **Step 4: Create directory structure**

```bash
cd lib
mkdir -p core/errors core/utils
mkdir -p domain/entities domain/repositories domain/usecases
mkdir -p data/models data/datasources data/repositories
mkdir -p presentation/bloc/auth presentation/bloc/receipt presentation/bloc/telegram
mkdir -p presentation/screens presentation/widgets
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add pubspec.yaml lib/firebase_options.dart
git commit -m "feat: initialize Flutter project with Clean Architecture + BLoC dependencies"
```

---

### Task 8: Core Layer — Failures & Formatters

**Files:**
- Create: `lib/core/errors/failures.dart`
- Create: `lib/core/utils/formatters.dart`

- [ ] **Step 1: Create Failure classes**

These replace raw exceptions. Every error in the app is represented as a typed Failure, so the UI can handle them predictably.

Create `lib/core/errors/failures.dart`:

```dart
import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  final String message;
  const Failure(this.message);

  @override
  List<Object> get props => [message];
}

class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

class FirestoreFailure extends Failure {
  const FirestoreFailure(super.message);
}

class TelegramLinkFailure extends Failure {
  const TelegramLinkFailure(super.message);
}
```

- [ ] **Step 2: Create Formatters**

Create `lib/core/utils/formatters.dart`:

```dart
import 'package:intl/intl.dart';

class CurrencyFormatter {
  static String format(int amount) {
    return NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    ).format(amount);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/core/
git commit -m "feat: add core layer with Failure classes and formatters"
```

---

### Task 9: Domain Layer — Entities

**Files:**
- Create: `lib/domain/entities/user_entity.dart`
- Create: `lib/domain/entities/receipt_entity.dart`

> **Key concept:** Entities are plain Dart classes with NO Firebase imports. They represent the business objects.

- [ ] **Step 1: Create User entity**

Create `lib/domain/entities/user_entity.dart`:

```dart
import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  final String uid;
  final String email;
  final String displayName;
  final int? telegramChatId;
  final DateTime createdAt;

  const UserEntity({
    required this.uid,
    required this.email,
    required this.displayName,
    this.telegramChatId,
    required this.createdAt,
  });

  bool get isTelegramLinked => telegramChatId != null;

  @override
  List<Object?> get props => [uid, email, displayName, telegramChatId, createdAt];
}
```

- [ ] **Step 2: Create Receipt entity**

Create `lib/domain/entities/receipt_entity.dart`:

```dart
import 'package:equatable/equatable.dart';

class ReceiptItemEntity extends Equatable {
  final String name;
  final int qty;
  final int price;

  const ReceiptItemEntity({
    required this.name,
    required this.qty,
    required this.price,
  });

  @override
  List<Object?> get props => [name, qty, price];
}

class ReceiptEntity extends Equatable {
  final String id;
  final String imageBase64;
  final String ocrRawText;
  final String merchantName;
  final int totalAmount;
  final String currency;
  final DateTime? transactionDate;
  final String category;
  final List<ReceiptItemEntity> items;
  final String status;
  final DateTime createdAt;
  final DateTime? confirmedAt;

  const ReceiptEntity({
    required this.id,
    required this.imageBase64,
    required this.ocrRawText,
    required this.merchantName,
    required this.totalAmount,
    required this.currency,
    this.transactionDate,
    required this.category,
    required this.items,
    required this.status,
    required this.createdAt,
    this.confirmedAt,
  });

  bool get needsReview => status == 'needs_review';

  @override
  List<Object?> get props => [id, merchantName, totalAmount, status, createdAt];
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/domain/entities/
git commit -m "feat: add domain entities (UserEntity, ReceiptEntity)"
```

---

### Task 10: Domain Layer — Repository Interfaces

**Files:**
- Create: `lib/domain/repositories/auth_repository.dart`
- Create: `lib/domain/repositories/receipt_repository.dart`

> **Key concept:** These are ABSTRACT classes. Domain says "I need a signIn method" but doesn't care if it's Firebase, Supabase, or mock data. The Data layer implements these.

- [ ] **Step 1: Create Auth repository interface**

Create `lib/domain/repositories/auth_repository.dart`:

```dart
import 'package:smart_business/core/errors/failures.dart';
import 'package:smart_business/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Stream<UserEntity?> get authStateChanges;
  Future<UserEntity?> getCurrentUser();
  Future<void> signIn(String email, String password);
  Future<void> signUp(String email, String password, String name);
  Future<void> signOut();
}
```

- [ ] **Step 2: Create Receipt repository interface**

Create `lib/domain/repositories/receipt_repository.dart`:

```dart
import 'package:smart_business/domain/entities/receipt_entity.dart';

abstract class ReceiptRepository {
  Stream<List<ReceiptEntity>> watchReceipts();
  Future<void> confirmReceipt(String receiptId);
  Future<void> updateReceipt(String receiptId, Map<String, dynamic> data);
  Future<void> generateLinkCode();
  Future<bool> checkTelegramLinked();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/domain/repositories/
git commit -m "feat: add domain repository interfaces"
```

---

### Task 11: Domain Layer — Use Cases

**Files:**
- Create: `lib/domain/usecases/sign_in_usecase.dart`
- Create: `lib/domain/usecases/sign_up_usecase.dart`
- Create: `lib/domain/usecases/get_current_user_usecase.dart`
- Create: `lib/domain/usecases/sign_out_usecase.dart`
- Create: `lib/domain/usecases/watch_receipts_usecase.dart`
- Create: `lib/domain/usecases/confirm_receipt_usecase.dart`
- Create: `lib/domain/usecases/update_receipt_usecase.dart`
- Create: `lib/domain/usecases/generate_link_code_usecase.dart`
- Create: `lib/domain/usecases/check_telegram_link_usecase.dart`

> **Key concept:** Each Use Case does ONE thing. It calls a repository method. This makes the code testable and keeps BLoCs thin.

- [ ] **Step 1: Create auth use cases**

Create `lib/domain/usecases/sign_in_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/auth_repository.dart';

class SignInUseCase {
  final AuthRepository repository;
  SignInUseCase(this.repository);

  Future<void> call(String email, String password) {
    return repository.signIn(email, password);
  }
}
```

Create `lib/domain/usecases/sign_up_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/auth_repository.dart';

class SignUpUseCase {
  final AuthRepository repository;
  SignUpUseCase(this.repository);

  Future<void> call(String email, String password, String name) {
    return repository.signUp(email, password, name);
  }
}
```

Create `lib/domain/usecases/get_current_user_usecase.dart`:

```dart
import 'package:smart_business/domain/entities/user_entity.dart';
import 'package:smart_business/domain/repositories/auth_repository.dart';

class GetCurrentUserUseCase {
  final AuthRepository repository;
  GetCurrentUserUseCase(this.repository);

  Future<UserEntity?> call() {
    return repository.getCurrentUser();
  }
}
```

Create `lib/domain/usecases/sign_out_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/auth_repository.dart';

class SignOutUseCase {
  final AuthRepository repository;
  SignOutUseCase(this.repository);

  Future<void> call() {
    return repository.signOut();
  }
}
```

- [ ] **Step 2: Create receipt use cases**

Create `lib/domain/usecases/watch_receipts_usecase.dart`:

```dart
import 'package:smart_business/domain/entities/receipt_entity.dart';
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class WatchReceiptsUseCase {
  final ReceiptRepository repository;
  WatchReceiptsUseCase(this.repository);

  Stream<List<ReceiptEntity>> call() {
    return repository.watchReceipts();
  }
}
```

Create `lib/domain/usecases/confirm_receipt_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class ConfirmReceiptUseCase {
  final ReceiptRepository repository;
  ConfirmReceiptUseCase(this.repository);

  Future<void> call(String receiptId) {
    return repository.confirmReceipt(receiptId);
  }
}
```

Create `lib/domain/usecases/update_receipt_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class UpdateReceiptUseCase {
  final ReceiptRepository repository;
  UpdateReceiptUseCase(this.repository);

  Future<void> call(String receiptId, Map<String, dynamic> data) {
    return repository.updateReceipt(receiptId, data);
  }
}
```

Create `lib/domain/usecases/generate_link_code_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class GenerateLinkCodeUseCase {
  final ReceiptRepository repository;
  GenerateLinkCodeUseCase(this.repository);

  Future<void> call() {
    return repository.generateLinkCode();
  }
}
```

Create `lib/domain/usecases/check_telegram_link_usecase.dart`:

```dart
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class CheckTelegramLinkUseCase {
  final ReceiptRepository repository;
  CheckTelegramLinkUseCase(this.repository);

  Future<bool> call() {
    return repository.checkTelegramLinked();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/domain/usecases/
git commit -m "feat: add domain use cases for auth and receipts"
```

---

### Task 12: Data Layer — Models (DTOs)

**Files:**
- Create: `lib/data/models/user_model.dart`
- Create: `lib/data/models/receipt_model.dart`

> **Key concept:** Models are Data Transfer Objects. They know about Firebase (toMap/fromMap) but convert to Domain entities. This keeps Firebase details OUT of the domain layer.

- [ ] **Step 1: Create User model**

Create `lib/data/models/user_model.dart`:

```dart
import 'package:smart_business/domain/entities/user_entity.dart';

class UserModel {
  final String uid;
  final String email;
  final String displayName;
  final int? telegramChatId;
  final DateTime createdAt;

  UserModel({
    required this.uid,
    required this.email,
    required this.displayName,
    this.telegramChatId,
    required this.createdAt,
  });

  UserEntity toEntity() => UserEntity(
        uid: uid,
        email: email,
        displayName: displayName,
        telegramChatId: telegramChatId,
        createdAt: createdAt,
      );

  factory UserModel.fromFirebase(String uid, Map<String, dynamic> data) {
    return UserModel(
      uid: uid,
      email: data['email'] ?? '',
      displayName: data['display_name'] ?? '',
      telegramChatId: data['telegram_chat_id'],
      createdAt: (data['created_at'] as dynamic).toDate(),
    );
  }
}
```

- [ ] **Step 2: Create Receipt model**

Create `lib/data/models/receipt_model.dart`:

```dart
import 'package:smart_business/domain/entities/receipt_entity.dart';

class ReceiptItemModel {
  final String name;
  final int qty;
  final int price;

  ReceiptItemModel({required this.name, required this.qty, required this.price});

  ReceiptItemEntity toEntity() => ReceiptItemEntity(
        name: name,
        qty: qty,
        price: price,
      );

  factory ReceiptItemModel.fromMap(Map<String, dynamic> data) {
    return ReceiptItemModel(
      name: data['name'] ?? '',
      qty: data['qty'] ?? 0,
      price: data['price'] ?? 0,
    );
  }
}

class ReceiptModel {
  final String id;
  final String imageBase64;
  final String ocrRawText;
  final String merchantName;
  final int totalAmount;
  final String currency;
  final DateTime? transactionDate;
  final String category;
  final List<ReceiptItemModel> items;
  final String status;
  final DateTime createdAt;
  final DateTime? confirmedAt;

  ReceiptModel({
    required this.id,
    required this.imageBase64,
    required this.ocrRawText,
    required this.merchantName,
    required this.totalAmount,
    required this.currency,
    this.transactionDate,
    required this.category,
    required this.items,
    required this.status,
    required this.createdAt,
    this.confirmedAt,
  });

  ReceiptEntity toEntity() => ReceiptEntity(
        id: id,
        imageBase64: imageBase64,
        ocrRawText: ocrRawText,
        merchantName: merchantName,
        totalAmount: totalAmount,
        currency: currency,
        transactionDate: transactionDate,
        category: category,
        items: items.map((i) => i.toEntity()).toList(),
        status: status,
        createdAt: createdAt,
        confirmedAt: confirmedAt,
      );

  factory ReceiptModel.fromFirestore(String id, Map<String, dynamic> data) {
    return ReceiptModel(
      id: id,
      imageBase64: data['image_base64'] ?? '',
      ocrRawText: data['ocr_raw_text'] ?? '',
      merchantName: data['merchant_name'] ?? '',
      totalAmount: data['total_amount'] ?? 0,
      currency: data['currency'] ?? 'IDR',
      transactionDate: data['transaction_date'] != null
          ? (data['transaction_date'] as dynamic).toDate()
          : null,
      category: data['category'] ?? 'other',
      items: (data['items'] as List?)
              ?.map((e) => ReceiptItemModel.fromMap(e as Map<String, dynamic>))
              .toList() ??
          [],
      status: data['status'] ?? 'needs_review',
      createdAt: (data['created_at'] as dynamic).toDate(),
      confirmedAt: data['confirmed_at'] != null
          ? (data['confirmed_at'] as dynamic).toDate()
          : null,
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/data/models/
git commit -m "feat: add data models (DTOs) with toEntity conversion"
```

---

### Task 13: Data Layer — DataSources

**Files:**
- Create: `lib/data/datasources/auth_remote_datasource.dart`
- Create: `lib/data/datasources/receipt_remote_datasource.dart`

> **Key concept:** DataSources talk directly to Firebase. They throw exceptions. The Repository implementation catches those and converts them to Failures.

- [ ] **Step 1: Create auth remote datasource**

Create `lib/data/datasources/auth_remote_datasource.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:smart_business/data/models/user_model.dart';

class AuthRemoteDataSource {
  final FirebaseAuth auth;
  final FirebaseFirestore firestore;

  AuthRemoteDataSource({required this.auth, required this.firestore});

  Stream<User?> get authStateChanges => auth.authStateChanges();

  User? get currentUser => auth.currentUser;

  Future<void> signIn(String email, String password) async {
    await auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<UserCredential> signUp(String email, String password, String name) async {
    final credential = await auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    await credential.user?.updateDisplayName(name);

    await firestore.collection('users').doc(credential.user!.uid).set({
      'email': email,
      'display_name': name,
      'telegram_chat_id': null,
      'link_code': null,
      'created_at': FieldValue.serverTimestamp(),
    });

    return credential;
  }

  Future<UserModel> getUserData(String uid) async {
    final doc = await firestore.collection('users').doc(uid).get();
    return UserModel.fromFirebase(uid, doc.data()!);
  }

  Future<void> signOut() async {
    await auth.signOut();
  }
}
```

- [ ] **Step 2: Create receipt remote datasource**

Create `lib/data/datasources/receipt_remote_datasource.dart`:

```dart
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:smart_business/data/models/receipt_model.dart';

class ReceiptRemoteDataSource {
  final FirebaseFirestore firestore;
  final FirebaseAuth auth;

  ReceiptRemoteDataSource({required this.firestore, required this.auth});

  String? get _uid => auth.currentUser?.uid;

  Stream<List<ReceiptModel>> watchReceipts() {
    if (_uid == null) return Stream.value([]);
    return firestore
        .collection('receipts')
        .doc(_uid)
        .collection('items')
        .orderBy('created_at', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => ReceiptModel.fromFirestore(doc.id, doc.data()))
            .toList());
  }

  Future<void> confirmReceipt(String receiptId) async {
    if (_uid == null) return;
    await firestore
        .collection('receipts')
        .doc(_uid)
        .collection('items')
        .doc(receiptId)
        .update({
      'status': 'confirmed',
      'confirmed_at': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateReceipt(String receiptId, Map<String, dynamic> data) async {
    if (_uid == null) return;
    await firestore
        .collection('receipts')
        .doc(_uid)
        .collection('items')
        .doc(receiptId)
        .update(data);
  }

  Future<ReceiptModel> getReceipt(String receiptId) async {
    if (_uid == null) throw Exception('Not authenticated');
    final doc = await firestore
        .collection('receipts')
        .doc(_uid)
        .collection('items')
        .doc(receiptId)
        .get();
    return ReceiptModel.fromFirestore(doc.id, doc.data()!);
  }

  Future<void> generateLinkCode(String code) async {
    if (_uid == null) return;
    await firestore.collection('users').doc(_uid).update({
      'link_code': code,
      'link_code_expires_at': Timestamp.fromDate(
        DateTime.now().add(const Duration(minutes: 10)),
      ),
    });
  }

  Future<bool> checkTelegramLinked() async {
    if (_uid == null) return false;
    final doc = await firestore.collection('users').doc(_uid).get();
    return doc.data()?['telegram_chat_id'] != null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/data/datasources/
git commit -m "feat: add remote datasources for auth and receipts"
```

---

### Task 14: Data Layer — Repository Implementations

**Files:**
- Create: `lib/data/repositories/auth_repository_impl.dart`
- Create: `lib/data/repositories/receipt_repository_impl.dart`

> **Key concept:** Repository implementations bridge DataSource exceptions → Domain Failures. The domain layer never sees a Firebase exception.

- [ ] **Step 1: Create auth repository implementation**

Create `lib/data/repositories/auth_repository_impl.dart`:

```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:smart_business/core/errors/failures.dart';
import 'package:smart_business/data/datasources/auth_remote_datasource.dart';
import 'package:smart_business/data/models/user_model.dart';
import 'package:smart_business/domain/entities/user_entity.dart';
import 'package:smart_business/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource dataSource;

  AuthRepositoryImpl({required this.dataSource});

  @override
  Stream<UserEntity?> get authStateChanges {
    return dataSource.authStateChanges.asyncMap((user) async {
      if (user == null) return null;
      try {
        final model = await dataSource.getUserData(user.uid);
        return model.toEntity();
      } catch (_) {
        return UserEntity(
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? '',
          createdAt: DateTime.now(),
        );
      }
    });
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    final user = dataSource.currentUser;
    if (user == null) return null;
    try {
      final model = await dataSource.getUserData(user.uid);
      return model.toEntity();
    } catch (_) {
      return UserEntity(
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        createdAt: DateTime.now(),
      );
    }
  }

  @override
  Future<void> signIn(String email, String password) async {
    try {
      await dataSource.signIn(email, password);
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.message ?? 'Sign in failed');
    } catch (e) {
      throw AuthFailure(e.toString());
    }
  }

  @override
  Future<void> signUp(String email, String password, String name) async {
    try {
      await dataSource.signUp(email, password, name);
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.message ?? 'Sign up failed');
    } catch (e) {
      throw AuthFailure(e.toString());
    }
  }

  @override
  Future<void> signOut() async {
    await dataSource.signOut();
  }
}
```

- [ ] **Step 2: Create receipt repository implementation**

Create `lib/data/repositories/receipt_repository_impl.dart`:

```dart
import 'dart:math';
import 'package:smart_business/core/errors/failures.dart';
import 'package:smart_business/data/datasources/receipt_remote_datasource.dart';
import 'package:smart_business/domain/entities/receipt_entity.dart';
import 'package:smart_business/domain/repositories/receipt_repository.dart';

class ReceiptRepositoryImpl implements ReceiptRepository {
  final ReceiptRemoteDataSource dataSource;

  ReceiptRepositoryImpl({required this.dataSource});

  @override
  Stream<List<ReceiptEntity>> watchReceipts() {
    return dataSource.watchReceipts().map((models) {
      return models.map((m) => m.toEntity()).toList();
    });
  }

  @override
  Future<void> confirmReceipt(String receiptId) async {
    try {
      await dataSource.confirmReceipt(receiptId);
    } catch (e) {
      throw FirestoreFailure('Failed to confirm receipt: $e');
    }
  }

  @override
  Future<void> updateReceipt(String receiptId, Map<String, dynamic> data) async {
    try {
      await dataSource.updateReceipt(receiptId, data);
    } catch (e) {
      throw FirestoreFailure('Failed to update receipt: $e');
    }
  }

  @override
  Future<void> generateLinkCode() async {
    try {
      final code = List.generate(6, (_) => Random().nextInt(10)).join();
      await dataSource.generateLinkCode(code);
    } catch (e) {
      throw TelegramLinkFailure('Failed to generate link code: $e');
    }
  }

  @override
  Future<bool> checkTelegramLinked() async {
    try {
      return await dataSource.checkTelegramLinked();
    } catch (e) {
      throw TelegramLinkFailure('Failed to check Telegram link: $e');
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/data/repositories/
git commit -m "feat: add repository implementations with error mapping"
```

---

### Task 15: Dependency Injection

**Files:**
- Create: `lib/injection.dart`

> **Key concept:** get_it wires everything together. BLoCs get Use Cases, Use Cases get Repositories, Repositories get DataSources. All from one place.

- [ ] **Step 1: Create service locator**

Create `lib/injection.dart`:

```dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:get_it/get_it.dart';

import 'package:smart_business/data/datasources/auth_remote_datasource.dart';
import 'package:smart_business/data/datasources/receipt_remote_datasource.dart';
import 'package:smart_business/data/repositories/auth_repository_impl.dart';
import 'package:smart_business/data/repositories/receipt_repository_impl.dart';
import 'package:smart_business/domain/repositories/auth_repository.dart';
import 'package:smart_business/domain/repositories/receipt_repository.dart';
import 'package:smart_business/domain/usecases/sign_in_usecase.dart';
import 'package:smart_business/domain/usecases/sign_up_usecase.dart';
import 'package:smart_business/domain/usecases/get_current_user_usecase.dart';
import 'package:smart_business/domain/usecases/sign_out_usecase.dart';
import 'package:smart_business/domain/usecases/watch_receipts_usecase.dart';
import 'package:smart_business/domain/usecases/confirm_receipt_usecase.dart';
import 'package:smart_business/domain/usecases/update_receipt_usecase.dart';
import 'package:smart_business/domain/usecases/generate_link_code_usecase.dart';
import 'package:smart_business/domain/usecases/check_telegram_link_usecase.dart';

import 'package:smart_business/presentation/bloc/auth/auth_bloc.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_bloc.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_bloc.dart';

final sl = GetIt.instance;

void setupInjection() {
  // Firebase instances
  sl.registerLazySingleton(() => FirebaseAuth.instance);
  sl.registerLazySingleton(() => FirebaseFirestore.instance);

  // DataSources
  sl.registerLazySingleton(() => AuthRemoteDataSource(
        auth: sl(),
        firestore: sl(),
      ));
  sl.registerLazySingleton(() => ReceiptRemoteDataSource(
        firestore: sl(),
        auth: sl(),
      ));

  // Repositories (Domain interfaces → Data implementations)
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(dataSource: sl()),
  );
  sl.registerLazySingleton<ReceiptRepository>(
    () => ReceiptRepositoryImpl(dataSource: sl()),
  );

  // Use Cases
  sl.registerLazySingleton(() => SignInUseCase(sl()));
  sl.registerLazySingleton(() => SignUpUseCase(sl()));
  sl.registerLazySingleton(() => GetCurrentUserUseCase(sl()));
  sl.registerLazySingleton(() => SignOutUseCase(sl()));
  sl.registerLazySingleton(() => WatchReceiptsUseCase(sl()));
  sl.registerLazySingleton(() => ConfirmReceiptUseCase(sl()));
  sl.registerLazySingleton(() => UpdateReceiptUseCase(sl()));
  sl.registerLazySingleton(() => GenerateLinkCodeUseCase(sl()));
  sl.registerLazySingleton(() => CheckTelegramLinkUseCase(sl()));

  // BLoCs (factories = new instance each time)
  sl.registerFactory(() => AuthBloc(
        signInUseCase: sl(),
        signUpUseCase: sl(),
        getCurrentUserUseCase: sl(),
        signOutUseCase: sl(),
        authRepository: sl(),
      ));
  sl.registerFactory(() => ReceiptBloc(
        watchReceiptsUseCase: sl(),
        confirmReceiptUseCase: sl(),
        updateReceiptUseCase: sl(),
      ));
  sl.registerFactory(() => TelegramBloc(
        generateLinkCodeUseCase: sl(),
        checkTelegramLinkUseCase: sl(),
      ));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/injection.dart
git commit -m "feat: add get_it dependency injection setup"
```

---

### Task 16: Presentation Layer — Auth BLoC

**Files:**
- Create: `lib/presentation/bloc/auth/auth_event.dart`
- Create: `lib/presentation/bloc/auth/auth_state.dart`
- Create: `lib/presentation/bloc/auth/auth_bloc.dart`

> **Key concept:** BLoC pattern — UI dispatches Events, BLoC processes them using Use Cases, emits States back to UI.

- [ ] **Step 1: Create auth events**

Create `lib/presentation/bloc/auth/auth_event.dart`:

```dart
import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthStarted extends AuthEvent {}

class AuthSignInRequested extends AuthEvent {
  final String email;
  final String password;

  AuthSignInRequested({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class AuthSignUpRequested extends AuthEvent {
  final String email;
  final String password;
  final String name;

  AuthSignUpRequested({
    required this.email,
    required this.password,
    required this.name,
  });

  @override
  List<Object?> get props => [email, password, name];
}

class AuthSignOutRequested extends AuthEvent {}
```

- [ ] **Step 2: Create auth states**

Create `lib/presentation/bloc/auth/auth_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import 'package:smart_business/domain/entities/user_entity.dart';

abstract class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class AuthAuthenticated extends AuthState {
  final UserEntity user;
  AuthAuthenticated(this.user);

  @override
  List<Object?> get props => [user];
}

class AuthUnauthenticated extends AuthState {}

class AuthError extends AuthState {
  final String message;
  AuthError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 3: Create auth bloc**

Create `lib/presentation/bloc/auth/auth_bloc.dart`:

```dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/domain/entities/user_entity.dart';
import 'package:smart_business/domain/repositories/auth_repository.dart';
import 'package:smart_business/domain/usecases/sign_in_usecase.dart';
import 'package:smart_business/domain/usecases/sign_up_usecase.dart';
import 'package:smart_business/domain/usecases/get_current_user_usecase.dart';
import 'package:smart_business/domain/usecases/sign_out_usecase.dart';
import 'package:smart_business/presentation/bloc/auth/auth_event.dart';
import 'package:smart_business/presentation/bloc/auth/auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final SignInUseCase signInUseCase;
  final SignUpUseCase signUpUseCase;
  final GetCurrentUserUseCase getCurrentUserUseCase;
  final SignOutUseCase signOutUseCase;
  final AuthRepository authRepository;

  StreamSubscription<UserEntity?>? _authSubscription;

  AuthBloc({
    required this.signInUseCase,
    required this.signUpUseCase,
    required this.getCurrentUserUseCase,
    required this.signOutUseCase,
    required this.authRepository,
  }) : super(AuthInitial()) {
    on<AuthStarted>(_onStarted);
    on<AuthSignInRequested>(_onSignIn);
    on<AuthSignUpRequested>(_onSignUp);
    on<AuthSignOutRequested>(_onSignOut);

    _authSubscription = authRepository.authStateChanges.listen((user) {
      if (user != null) {
        add(AuthStarted());
      }
    });
  }

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final user = await getCurrentUserUseCase();
    if (user != null) {
      emit(AuthAuthenticated(user));
    } else {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> _onSignIn(
    AuthSignInRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await signInUseCase(event.email, event.password);
    } catch (e) {
      emit(AuthError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onSignUp(
    AuthSignUpRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await signUpUseCase(event.email, event.password, event.name);
    } catch (e) {
      emit(AuthError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onSignOut(
    AuthSignOutRequested event,
    Emitter<AuthState> emit,
  ) async {
    await signOutUseCase();
    emit(AuthUnauthenticated());
  }

  @override
  Future<void> close() {
    _authSubscription?.cancel();
    return super.close();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/presentation/bloc/auth/
git commit -m "feat: add Auth BLoC with events, states, and use case integration"
```

---

### Task 17: Presentation Layer — Receipt BLoC

**Files:**
- Create: `lib/presentation/bloc/receipt/receipt_event.dart`
- Create: `lib/presentation/bloc/receipt/receipt_state.dart`
- Create: `lib/presentation/bloc/receipt/receipt_bloc.dart`

- [ ] **Step 1: Create receipt events**

Create `lib/presentation/bloc/receipt/receipt_event.dart`:

```dart
import 'package:equatable/equatable.dart';

abstract class ReceiptEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class ReceiptsWatchStarted extends ReceiptEvent {}

class ReceiptConfirmRequested extends ReceiptEvent {
  final String receiptId;
  ReceiptConfirmRequested(this.receiptId);

  @override
  List<Object?> get props => [receiptId];
}

class ReceiptUpdateRequested extends ReceiptEvent {
  final String receiptId;
  final Map<String, dynamic> data;

  ReceiptUpdateRequested({required this.receiptId, required this.data});

  @override
  List<Object?> get props => [receiptId, data];
}
```

- [ ] **Step 2: Create receipt states**

Create `lib/presentation/bloc/receipt/receipt_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import 'package:smart_business/domain/entities/receipt_entity.dart';

abstract class ReceiptState extends Equatable {
  @override
  List<Object?> get props => [];
}

class ReceiptInitial extends ReceiptState {}

class ReceiptLoading extends ReceiptState {}

class ReceiptLoaded extends ReceiptState {
  final List<ReceiptEntity> receipts;
  ReceiptLoaded(this.receipts);

  int get monthlyTotal {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    return receipts
        .where((r) => r.createdAt.isAfter(monthStart))
        .fold<int>(0, (sum, r) => sum + r.totalAmount);
  }

  int get needsReviewCount => receipts.where((r) => r.needsReview).length;

  Map<String, int> get categoryBreakdown {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    final monthly = receipts.where((r) => r.createdAt.isAfter(monthStart));
    final breakdown = <String, int>{};
    for (final r in monthly) {
      breakdown[r.category] = (breakdown[r.category] ?? 0) + r.totalAmount;
    }
    return breakdown;
  }

  @override
  List<Object?> get props => [receipts];
}

class ReceiptActionSuccess extends ReceiptState {}

class ReceiptError extends ReceiptState {
  final String message;
  ReceiptError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 3: Create receipt bloc**

Create `lib/presentation/bloc/receipt/receipt_bloc.dart`:

```dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/domain/usecases/watch_receipts_usecase.dart';
import 'package:smart_business/domain/usecases/confirm_receipt_usecase.dart';
import 'package:smart_business/domain/usecases/update_receipt_usecase.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_event.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_state.dart';

class ReceiptBloc extends Bloc<ReceiptEvent, ReceiptState> {
  final WatchReceiptsUseCase watchReceiptsUseCase;
  final ConfirmReceiptUseCase confirmReceiptUseCase;
  final UpdateReceiptUseCase updateReceiptUseCase;

  StreamSubscription? _receiptsSubscription;

  ReceiptBloc({
    required this.watchReceiptsUseCase,
    required this.confirmReceiptUseCase,
    required this.updateReceiptUseCase,
  }) : super(ReceiptInitial()) {
    on<ReceiptsWatchStarted>(_onWatchStarted);
    on<ReceiptConfirmRequested>(_onConfirm);
    on<ReceiptUpdateRequested>(_onUpdate);
  }

  Future<void> _onWatchStarted(
    ReceiptsWatchStarted event,
    Emitter<ReceiptState> emit,
  ) async {
    emit(ReceiptLoading());
    _receiptsSubscription?.cancel();
    _receiptsSubscription = watchReceiptsUseCase().listen(
      (receipts) => emit(ReceiptLoaded(receipts)),
      onError: (e) => emit(ReceiptError(e.toString())),
    );
  }

  Future<void> _onConfirm(
    ReceiptConfirmRequested event,
    Emitter<ReceiptState> emit,
  ) async {
    try {
      await confirmReceiptUseCase(event.receiptId);
      emit(ReceiptActionSuccess());
    } catch (e) {
      emit(ReceiptError(e.toString()));
    }
  }

  Future<void> _onUpdate(
    ReceiptUpdateRequested event,
    Emitter<ReceiptState> emit,
  ) async {
    try {
      await updateReceiptUseCase(event.receiptId, event.data);
      emit(ReceiptActionSuccess());
    } catch (e) {
      emit(ReceiptError(e.toString()));
    }
  }

  @override
  Future<void> close() {
    _receiptsSubscription?.cancel();
    return super.close();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/presentation/bloc/receipt/
git commit -m "feat: add Receipt BLoC with stream-based receipt watching"
```

---

### Task 18: Presentation Layer — Telegram BLoC

**Files:**
- Create: `lib/presentation/bloc/telegram/telegram_event.dart`
- Create: `lib/presentation/bloc/telegram/telegram_state.dart`
- Create: `lib/presentation/bloc/telegram/telegram_bloc.dart`

- [ ] **Step 1: Create telegram events**

Create `lib/presentation/bloc/telegram/telegram_event.dart`:

```dart
import 'package:equatable/equatable.dart';

abstract class TelegramEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class TelegramCheckStarted extends TelegramEvent {}

class TelegramLinkCodeGenerated extends TelegramEvent {}
```

- [ ] **Step 2: Create telegram states**

Create `lib/presentation/bloc/telegram/telegram_state.dart`:

```dart
import 'package:equatable/equatable.dart';

abstract class TelegramState extends Equatable {
  @override
  List<Object?> get props => [];
}

class TelegramInitial extends TelegramState {}

class TelegramLoading extends TelegramState {}

class TelegramLinked extends TelegramState {}

class TelegramNotLinked extends TelegramState {}

class TelegramCodeGenerated extends TelegramState {
  final String code;
  TelegramCodeGenerated(this.code);

  @override
  List<Object?> get props => [code];
}

class TelegramError extends TelegramState {
  final String message;
  TelegramError(this.message);

  @override
  List<Object?> get props => [message];
}
```

- [ ] **Step 3: Create telegram bloc**

Create `lib/presentation/bloc/telegram/telegram_bloc.dart`:

```dart
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/domain/usecases/generate_link_code_usecase.dart';
import 'package:smart_business/domain/usecases/check_telegram_link_usecase.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_event.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_state.dart';

class TelegramBloc extends Bloc<TelegramEvent, TelegramState> {
  final GenerateLinkCodeUseCase generateLinkCodeUseCase;
  final CheckTelegramLinkUseCase checkTelegramLinkUseCase;

  Timer? _refreshTimer;

  TelegramBloc({
    required this.generateLinkCodeUseCase,
    required this.checkTelegramLinkUseCase,
  }) : super(TelegramInitial()) {
    on<TelegramCheckStarted>(_onCheckStarted);
    on<TelegramLinkCodeGenerated>(_onGenerateCode);
  }

  Future<void> _onCheckStarted(
    TelegramCheckStarted event,
    Emitter<TelegramState> emit,
  ) async {
    emit(TelegramLoading());
    try {
      final isLinked = await checkTelegramLinkUseCase();
      if (isLinked) {
        emit(TelegramLinked());
      } else {
        emit(TelegramNotLinked());
      }
    } catch (e) {
      emit(TelegramError(e.toString()));
    }

    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final isLinked = await checkTelegramLinkUseCase();
        if (isLinked) {
          emit(TelegramLinked());
        }
      } catch (_) {}
    });
  }

  Future<void> _onGenerateCode(
    TelegramLinkCodeGenerated event,
    Emitter<TelegramState> emit,
  ) async {
    emit(TelegramLoading());
    try {
      await generateLinkCodeUseCase();
    } catch (e) {
      emit(TelegramError(e.toString()));
    }
  }

  @override
  Future<void> close() {
    _refreshTimer?.cancel();
    return super.close();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/presentation/bloc/telegram/
git commit -m "feat: add Telegram BLoC with link code generation and polling"
```

---

### Task 19: App Entry — main.dart & app.dart

**Files:**
- Create: `lib/main.dart`
- Create: `lib/app.dart`

- [ ] **Step 1: Create main.dart**

Create `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'firebase_options.dart';
import 'injection.dart';
import 'app.dart';
import 'presentation/bloc/auth/auth_bloc.dart';
import 'presentation/bloc/receipt/receipt_bloc.dart';
import 'presentation/bloc/telegram/telegram_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  setupInjection();
  runApp(const SmartBusinessApp());
}

class SmartBusinessApp extends StatelessWidget {
  const SmartBusinessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => sl<AuthBloc>()..add(AuthStarted())),
        BlocProvider(create: (_) => sl<ReceiptBloc>()..add(ReceiptsWatchStarted())),
        BlocProvider(create: (_) => sl<TelegramBloc>()..add(TelegramCheckStarted())),
      ],
      child: const App(),
    );
  }
}
```

- [ ] **Step 2: Create app.dart with GoRouter**

Create `lib/app.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_business/presentation/bloc/auth/auth_bloc.dart';
import 'package:smart_business/presentation/bloc/auth/auth_state.dart';
import 'package:smart_business/presentation/screens/login_screen.dart';
import 'package:smart_business/presentation/screens/home_screen.dart';
import 'package:smart_business/presentation/screens/receipt_list_screen.dart';
import 'package:smart_business/presentation/screens/receipt_detail_screen.dart';
import 'package:smart_business/presentation/screens/reports_screen.dart';
import 'package:smart_business/presentation/screens/telegram_link_screen.dart';
import 'package:smart_business/presentation/screens/settings_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = GoRouter(
  navigatorKey: _rootNavigatorKey,
  redirect: (context, state) {
    final authState = context.read<AuthBloc>().state;
    final isLoggedIn = authState is AuthAuthenticated;
    final isLoginRoute = state.matchedLocation == '/login';
    if (!isLoggedIn && !isLoginRoute) return '/login';
    if (isLoggedIn && isLoginRoute) return '/';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    ShellRoute(
      builder: (context, state, child) => ScaffoldWithNavBar(child: child),
      routes: [
        GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
        GoRoute(path: '/reports', builder: (context, state) => const ReportsScreen()),
        GoRoute(path: '/settings', builder: (context, state) => const SettingsScreen()),
      ],
    ),
    GoRoute(path: '/receipts', builder: (context, state) => const ReceiptListScreen()),
    GoRoute(
      path: '/receipts/:id',
      builder: (context, state) => ReceiptDetailScreen(
        receiptId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(path: '/telegram-link', builder: (context, state) => const TelegramLinkScreen()),
  ],
);

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Smart Business',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1A73E8),
        useMaterial3: true,
      ),
      routerConfig: routerProvider,
    );
  }
}

class ScaffoldWithNavBar extends StatelessWidget {
  final Widget child;
  const ScaffoldWithNavBar({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Reports'),
        ],
        onDestinationSelected: (index) {
          if (index == 0) context.go('/');
          if (index == 1) context.go('/reports');
        },
        selectedIndex: _getCurrentIndex(context),
      ),
    );
  }

  int _getCurrentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/reports')) return 1;
    return 0;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/main.dart lib/app.dart
git commit -m "feat: add app entry with MultiBlocProvider and GoRouter"
```

---

### Task 20: Presentation Layer — Widgets

**Files:**
- Create: `lib/presentation/widgets/summary_card.dart`
- Create: `lib/presentation/widgets/receipt_card.dart`
- Create: `lib/presentation/widgets/category_chart.dart`

- [ ] **Step 1: Create summary card**

Create `lib/presentation/widgets/summary_card.dart`:

```dart
import 'package:flutter/material.dart';

class SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color? color;

  const SummaryCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color ?? Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(title, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Create receipt card**

Create `lib/presentation/widgets/receipt_card.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_business/core/utils/formatters.dart';
import 'package:smart_business/domain/entities/receipt_entity.dart';

class ReceiptCard extends StatelessWidget {
  final ReceiptEntity receipt;
  const ReceiptCard({super.key, required this.receipt});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: receipt.needsReview
                ? Colors.orange.withValues(alpha: 0.1)
                : Colors.green.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            receipt.needsReview ? Icons.pending : Icons.check_circle,
            color: receipt.needsReview ? Colors.orange : Colors.green,
          ),
        ),
        title: Text(receipt.merchantName, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          CurrencyFormatter.format(receipt.totalAmount),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        trailing: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(receipt.category, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            Text(
              '${receipt.createdAt.day}/${receipt.createdAt.month}/${receipt.createdAt.year}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
          ],
        ),
        onTap: () => context.push('/receipts/${receipt.id}'),
      ),
    );
  }
}
```

- [ ] **Step 3: Create category chart**

Create `lib/presentation/widgets/category_chart.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:smart_business/core/utils/formatters.dart';

class CategoryChart extends StatelessWidget {
  final Map<String, int> data;
  const CategoryChart({super.key, required this.data});

  static const _categoryColors = {
    'transport': Color(0xFF4285F4),
    'food': Color(0xFFEA4335),
    'supplies': Color(0xFF34A853),
    'utilities': Color(0xFFFBBC05),
    'office': Color(0xFF8E44AD),
    'other': Color(0xFF95A5A6),
  };

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No data this month', textAlign: TextAlign.center),
        ),
      );
    }

    final total = data.values.fold<int>(0, (a, b) => a + b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Spending by Category', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sections: data.entries.map((entry) {
                    final color = _categoryColors[entry.key] ?? const Color(0xFF95A5A6);
                    final percentage = total > 0 ? entry.value / total : 0;
                    return PieChartSectionData(
                      value: entry.value.toDouble(),
                      title: '${(percentage * 100).toStringAsFixed(0)}%',
                      color: color,
                      radius: 80,
                      titleStyle: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),
            ...data.entries.map((entry) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Container(width: 12, height: 12, color: _categoryColors[entry.key] ?? Colors.grey),
                      const SizedBox(width: 8),
                      Expanded(child: Text(entry.key)),
                      Text(CurrencyFormatter.format(entry.value)),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/presentation/widgets/
git commit -m "feat: add shared widgets (SummaryCard, ReceiptCard, CategoryChart)"
```

---

### Task 21: Presentation Layer — Screens

**Files:**
- Create: `lib/presentation/screens/login_screen.dart`
- Create: `lib/presentation/screens/home_screen.dart`
- Create: `lib/presentation/screens/receipt_list_screen.dart`
- Create: `lib/presentation/screens/receipt_detail_screen.dart`
- Create: `lib/presentation/screens/reports_screen.dart`
- Create: `lib/presentation/screens/telegram_link_screen.dart`
- Create: `lib/presentation/screens/settings_screen.dart`

- [ ] **Step 1: Create login screen**

Create `lib/presentation/screens/login_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/presentation/bloc/auth/auth_bloc.dart';
import 'package:smart_business/presentation/bloc/auth/auth_event.dart';
import 'package:smart_business/presentation/bloc/auth/auth_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool isSignUp = false;
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.receipt_long, size: 64, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 16),
                Text('Smart Business', style: Theme.of(context).textTheme.headlineMedium, textAlign: TextAlign.center),
                const SizedBox(height: 32),
                if (isSignUp)
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(labelText: 'Name'),
                    validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                  ),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v?.contains('@') != true ? 'Invalid email' : null,
                ),
                TextFormField(
                  controller: _passwordController,
                  decoration: const InputDecoration(labelText: 'Password'),
                  obscureText: true,
                  validator: (v) => (v?.length ?? 0) < 6 ? 'Min 6 characters' : null,
                ),
                const SizedBox(height: 16),
                BlocBuilder<AuthBloc, AuthState>(
                  builder: (context, state) {
                    if (state is AuthError) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(state.message, style: const TextStyle(color: Colors.red)),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
                BlocBuilder<AuthBloc, AuthState>(
                  builder: (context, state) {
                    final loading = state is AuthLoading;
                    return FilledButton(
                      onPressed: loading ? null : _submit,
                      child: loading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(isSignUp ? 'Create Account' : 'Sign In'),
                    );
                  },
                ),
                TextButton(
                  onPressed: () => setState(() => isSignUp = !isSignUp),
                  child: Text(isSignUp ? 'Already have an account? Sign in' : 'No account? Sign up'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (isSignUp) {
      context.read<AuthBloc>().add(AuthSignUpRequested(
            email: _emailController.text.trim(),
            password: _passwordController.text,
            name: _nameController.text.trim(),
          ));
    } else {
      context.read<AuthBloc>().add(AuthSignInRequested(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          ));
    }
  }
}
```

- [ ] **Step 2: Create home screen**

Create `lib/presentation/screens/home_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_business/core/utils/formatters.dart';
import 'package:smart_business/presentation/bloc/auth/auth_bloc.dart';
import 'package:smart_business/presentation/bloc/auth/auth_state.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_bloc.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_state.dart';
import 'package:smart_business/presentation/widgets/summary_card.dart';
import 'package:smart_business/presentation/widgets/receipt_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Business'),
        actions: [
          IconButton(icon: const Icon(Icons.link), onPressed: () => context.push('/telegram-link')),
          IconButton(icon: const Icon(Icons.settings), onPressed: () => context.push('/settings')),
        ],
      ),
      body: BlocBuilder<ReceiptBloc, ReceiptState>(
        builder: (context, state) {
          if (state is ReceiptLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is ReceiptLoaded) {
            final receipts = state.receipts;
            final authState = context.watch<AuthBloc>().state;
            final isLoggedIn = authState is AuthAuthenticated;

            return RefreshIndicator(
              onRefresh: () async => context.read<ReceiptBloc>().add(ReceiptsWatchStarted()),
              child: CustomScrollView(
                slivers: [
                  const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Expanded(child: SummaryCard(title: 'This Month', value: CurrencyFormatter.format(state.monthlyTotal), icon: Icons.attach_money)),
                          const SizedBox(width: 8),
                          Expanded(child: SummaryCard(title: 'Receipts', value: '${receipts.length}', icon: Icons.receipt)),
                        ],
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: SummaryCard(
                        title: 'Needs Review',
                        value: '${state.needsReviewCount} pending',
                        icon: Icons.pending,
                        color: state.needsReviewCount > 0 ? Colors.orange : Colors.green,
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  if (isLoggedIn)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Card(
                          color: Colors.blue.shade50,
                          child: ListTile(
                            leading: const Icon(Icons.send),
                            title: const Text('Connect Telegram'),
                            subtitle: const Text('Link your Telegram to scan receipts via bot'),
                            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                            onTap: () => context.push('/telegram-link'),
                          ),
                        ),
                      ),
                    ),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text('Recent Receipts', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  if (receipts.isEmpty)
                    const SliverToBoxAdapter(
                      child: Center(child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Text('No receipts yet. Send a photo to your Telegram bot!'),
                      )),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => ReceiptCard(receipt: receipts[index]),
                        childCount: receipts.length,
                      ),
                    ),
                ],
              ),
            );
          }
          return const Center(child: Text('Something went wrong'));
        },
      ),
    );
  }
}
```

- [ ] **Step 3: Create receipt list screen**

Create `lib/presentation/screens/receipt_list_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/domain/entities/receipt_entity.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_bloc.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_state.dart';
import 'package:smart_business/presentation/widgets/receipt_card.dart';

class ReceiptListScreen extends StatefulWidget {
  const ReceiptListScreen({super.key});

  @override
  State<ReceiptListScreen> createState() => _ReceiptListScreenState();
}

class _ReceiptListScreenState extends State<ReceiptListScreen> {
  String _selectedCategory = 'all';
  String _selectedStatus = 'all';
  final _searchController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('All Receipts')),
      body: BlocBuilder<ReceiptBloc, ReceiptState>(
        builder: (context, state) {
          if (state is! ReceiptLoaded) return const Center(child: CircularProgressIndicator());

          var receipts = state.receipts;
          if (_selectedCategory != 'all') {
            receipts = receipts.where((r) => r.category == _selectedCategory).toList();
          }
          if (_selectedStatus != 'all') {
            receipts = receipts.where((r) => r.status == _selectedStatus).toList();
          }
          if (_searchController.text.isNotEmpty) {
            final q = _searchController.text.toLowerCase();
            receipts = receipts.where((r) => r.merchantName.toLowerCase().contains(q)).toList();
          }

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(hintText: 'Search by merchant...', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(children: [
                  _chip('All', 'all', _selectedStatus, 'status'),
                  _chip('Needs Review', 'needs_review', _selectedStatus, 'status'),
                  _chip('Confirmed', 'confirmed', _selectedStatus, 'status'),
                  const SizedBox(width: 16),
                  _chip('All', 'all', _selectedCategory, 'category'),
                  _chip('Transport', 'transport', _selectedCategory, 'category'),
                  _chip('Food', 'food', _selectedCategory, 'category'),
                  _chip('Supplies', 'supplies', _selectedCategory, 'category'),
                  _chip('Utilities', 'utilities', _selectedCategory, 'category'),
                  _chip('Office', 'office', _selectedCategory, 'category'),
                  _chip('Other', 'other', _selectedCategory, 'category'),
                ]),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: receipts.isEmpty
                    ? const Center(child: Text('No receipts found'))
                    : ListView.builder(
                        itemCount: receipts.length,
                        itemBuilder: (_, i) => ReceiptCard(receipt: receipts[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _chip(String label, String value, String selected, String type) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: value == selected,
        onSelected: (_) => setState(() {
          if (type == 'status') _selectedStatus = value;
          else _selectedCategory = value;
        }),
      ),
    );
  }
}
```

- [ ] **Step 4: Create receipt detail screen**

Create `lib/presentation/screens/receipt_detail_screen.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:smart_business/core/utils/formatters.dart';
import 'package:smart_business/data/datasources/receipt_remote_datasource.dart';
import 'package:smart_business/data/models/receipt_model.dart';
import 'package:smart_business/injection.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_bloc.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_event.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_state.dart';

class ReceiptDetailScreen extends StatefulWidget {
  final String receiptId;
  const ReceiptDetailScreen({super.key, required this.receiptId});

  @override
  State<ReceiptDetailScreen> createState() => _ReceiptDetailScreenState();
}

class _ReceiptDetailScreenState extends State<ReceiptDetailScreen> {
  bool _loading = false;
  bool _editing = false;
  ReceiptModel? _receipt;

  late TextEditingController _merchantController;
  late TextEditingController _amountController;
  late TextEditingController _categoryController;

  @override
  void initState() {
    super.initState();
    _merchantController = TextEditingController();
    _amountController = TextEditingController();
    _categoryController = TextEditingController();
    _loadReceipt();
  }

  Future<void> _loadReceipt() async {
    final ds = sl<ReceiptRemoteDataSource>();
    final model = await ds.getReceipt(widget.receiptId);
    setState(() {
      _receipt = model;
      _merchantController.text = model.merchantName;
      _amountController.text = model.totalAmount.toString();
      _categoryController.text = model.category;
    });
  }

  Future<void> _confirm() async {
    setState(() => _loading = true);
    context.read<ReceiptBloc>().add(ReceiptConfirmRequested(widget.receiptId));
    setState(() => _loading = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Receipt confirmed')));
      await _loadReceipt();
      setState(() => _editing = false);
    }
  }

  Future<void> _saveEdits() async {
    setState(() => _loading = true);
    context.read<ReceiptBloc>().add(ReceiptUpdateRequested(
          receiptId: widget.receiptId,
          data: {
            'merchant_name': _merchantController.text.trim(),
            'total_amount': int.tryParse(_amountController.text) ?? _receipt!.totalAmount,
            'category': _categoryController.text.trim(),
          },
        ));
    setState(() { _loading = false; _editing = false; });
    await _loadReceipt();
  }

  @override
  Widget build(BuildContext context) {
    if (_receipt == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receipt Detail'),
        actions: [
          if (!_editing) IconButton(icon: const Icon(Icons.edit), onPressed: () => setState(() => _editing = true)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: _receipt!.imageBase64.isNotEmpty
                  ? Image.memory(base64Decode(_receipt!.imageBase64), height: 200, width: double.infinity, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _placeholder())
                  : _placeholder(),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: _receipt!.status == 'needs_review' ? Colors.orange.shade50 : Colors.green.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _receipt!.status == 'needs_review' ? 'Needs Review' : 'Confirmed',
                style: TextStyle(
                  color: _receipt!.status == 'needs_review' ? Colors.orange : Colors.green,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 24),
            _field('Merchant', _merchantController),
            _field('Amount (IDR)', _amountController),
            _field('Category', _categoryController),
            if (_receipt!.transactionDate != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(children: [
                  const Text('Date: ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text(_receipt!.transactionDate.toString().substring(0, 10)),
                ]),
              ),
            const SizedBox(height: 32),
            if (_editing) ...[
              FilledButton(onPressed: _loading ? null : _saveEdits, child: _loading ? const CircularProgressIndicator(strokeWidth: 2) : const Text('Save Changes')),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => setState(() => _editing = false), child: const Text('Cancel')),
            ] else if (_receipt!.status == 'needs_review') ...[
              FilledButton(onPressed: _loading ? null : _confirm, child: _loading ? const CircularProgressIndicator(strokeWidth: 2) : const Text('Confirm Receipt')),
            ],
          ],
        ),
      ),
    );
  }

  Widget _placeholder() => Container(height: 200, color: Colors.grey[200], child: const Center(child: Icon(Icons.receipt_long, size: 48)));

  Widget _field(String label, TextEditingController controller) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextField(
          controller: controller,
          enabled: _editing,
          decoration: InputDecoration(labelText: label, border: _editing ? const OutlineInputBorder() : InputBorder.none),
        ),
      );
}
```

- [ ] **Step 5: Create reports screen**

Create `lib/presentation/screens/reports_screen.dart`:

```dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:smart_business/core/utils/formatters.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_bloc.dart';
import 'package:smart_business/presentation/bloc/receipt/receipt_state.dart';
import 'package:smart_business/presentation/widgets/summary_card.dart';
import 'package:smart_business/presentation/widgets/category_chart.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: BlocBuilder<ReceiptBloc, ReceiptState>(
        builder: (context, state) {
          if (state is! ReceiptLoaded) return const Center(child: CircularProgressIndicator());

          return RefreshIndicator(
            onRefresh: () async => context.read<ReceiptBloc>().add(ReceiptsWatchStarted()),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SummaryCard(title: 'Monthly Total', value: CurrencyFormatter.format(state.monthlyTotal), icon: Icons.attach_money),
                  const SizedBox(height: 16),
                  CategoryChart(data: state.categoryBreakdown),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: state.receipts.isEmpty ? null : () => _exportCsv(state),
                    icon: const Icon(Icons.download),
                    label: const Text('Export CSV'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _exportCsv(ReceiptLoaded state) async {
    final buffer = StringBuffer();
    buffer.writeln('Date,Merchant,Amount,Category,Status');
    for (final r in state.receipts) {
      buffer.writeln('${r.createdAt.toString().substring(0, 10)},"${r.merchantName}",${r.totalAmount},${r.category},${r.status}');
    }
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/receipts_export.csv');
    await file.writeAsString(buffer.toString());
    await Share.shareXFiles([XFile(file.path)], subject: 'Smart Business Receipts Export');
  }
}
```

- [ ] **Step 6: Create telegram link screen**

Create `lib/presentation/screens/telegram_link_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_bloc.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_event.dart';
import 'package:smart_business/presentation/bloc/telegram/telegram_state.dart';

class TelegramLinkScreen extends StatelessWidget {
  const TelegramLinkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connect Telegram')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: BlocConsumer<TelegramBloc, TelegramState>(
          listener: (context, state) {},
          builder: (context, state) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.send, size: 48),
                const SizedBox(height: 16),
                const Text('Connect your Telegram account to send receipts directly from Telegram.', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 32),
                if (state is TelegramLinked) ...[
                  const Icon(Icons.check_circle, color: Colors.green, size: 48),
                  const SizedBox(height: 16),
                  const Text('Telegram account connected!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: () => context.go('/'), child: const Text('Back to Home')),
                ] else if (state is TelegramCodeGenerated) ...[
                  Text('Your link code:', style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
                    decoration: BoxDecoration(color: Theme.of(context).colorScheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
                    child: Text(state.code, style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold, letterSpacing: 8)),
                  ),
                  const SizedBox(height: 16),
                  Text('Send this to your Telegram bot:\n/link ${state.code}', style: const TextStyle(fontSize: 14), textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  FilledButton(onPressed: () => context.read<TelegramBloc>().add(TelegramLinkCodeGenerated()), child: const Text('Regenerate Code')),
                ] else ...[
                  FilledButton(
                    onPressed: state is TelegramLoading
                        ? null
                        : () => context.read<TelegramBloc>().add(TelegramLinkCodeGenerated()),
                    child: state is TelegramLoading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Generate Link Code'),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
```

- [ ] **Step 7: Create settings screen**

Create `lib/presentation/screens/settings_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:smart_business/presentation/bloc/auth/auth_bloc.dart';
import 'package:smart_business/presentation/bloc/auth/auth_event.dart';
import 'package:smart_business/presentation/bloc/auth/auth_state.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          ListTile(leading: const Icon(Icons.person), title: Text(user?.displayName ?? 'Unknown'), subtitle: Text(user?.email ?? '')),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.link),
            title: const Text('Telegram Connection'),
            subtitle: const Text('Manage Telegram bot linking'),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () => context.push('/telegram-link'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
            onTap: () {
              context.read<AuthBloc>().add(AuthSignOutRequested());
              context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/presentation/screens/
git commit -m "feat: add all screens using BLoC pattern"
```

---

### Task 22: CSV Export Service

**Files:**
- Create: `lib/data/services/csv_export_service.dart`

> CSV export is moved into the reports screen directly since it's simple. This task is already handled in Task 21 Step 5.

- [ ] **Step 1: Verify export works in reports screen** (already done above)

---

### Task 23: End-to-End Integration Test

- [ ] **Step 1: Test the full flow**

1. Start the local server: `cd server && node index.js`
2. Start ngrok: `ngrok http 3000`
3. Set the Telegram webhook with the ngrok URL
4. Open the Flutter app, sign up with email/password
5. Tap "Connect Telegram", note the 6-digit code
6. On Telegram, send `/link ABC123` to your bot
7. Bot replies: "Account connected!"
8. Take a photo of a receipt, send it to the Telegram bot
9. Bot replies with parsed merchant name and amount
10. Open Flutter app, check Home screen — receipt appears with "Needs Review"
11. Tap receipt, review parsed data and receipt image, tap "Confirm Receipt"
12. Go to Reports — pie chart updates with new receipt
13. Tap "Export CSV" — CSV file downloads with the receipt data

- [ ] **Step 2: Fix any issues found during testing**

Address bugs discovered in the integration test.

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| Backend (Tasks 1-6) | Firebase setup, Express.js server, ngrok, Telegram bot | Working bot that receives photos, runs OCR, stores in Firestore (all free) |
| Flutter Core (Tasks 7-8) | Project setup, failures, formatters | Clean Architecture foundation |
| Flutter Domain (Tasks 9-11) | Entities, repository interfaces, use cases | Pure Dart business logic layer |
| Flutter Data (Tasks 12-14) | Models, datasources, repository impls | Firebase integration layer |
| Flutter DI (Task 15) | get_it setup | Dependency injection wiring |
| Flutter BLoC (Tasks 16-18) | Auth, Receipt, Telegram BLoCs | State management |
| Flutter UI (Tasks 19-21) | App entry, widgets, all screens | Complete UI |
| Integration (Tasks 22-23) | CSV export, end-to-end test | Full flow verified |

## Clean Architecture Layers — What Goes Where

| | Contains | Depends on | Example |
|---|---|---|---|
| **Domain** | Entities, repo interfaces, use cases | Nothing (pure Dart) | `ReceiptEntity`, `SignInUseCase` |
| **Data** | Models (DTOs), datasources, repo impls | Domain | `ReceiptModel.fromFirestore()`, `AuthRepositoryImpl` |
| **Presentation** | BLoCs, screens, widgets | Domain | `ReceiptBloc`, `HomeScreen` |
| **Core** | Failures, formatters | Nothing | `AuthFailure`, `CurrencyFormatter` |

## Cost: $0 — Everything on free tiers

| Service | Free tier | Limits |
|---|---|---|
| Firebase Auth | Spark plan | 10K verifications/day |
| Firebase Firestore | Spark plan | 1GB storage, 50K reads/day |
| Express.js server | Local machine | You run it |
| ngrok | Free plan | URL changes on restart |
| Telegram Bot API | Free | Unlimited |
