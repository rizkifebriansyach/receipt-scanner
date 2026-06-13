# Smart Business Receipt & Invoice Scanner — Telegram Integration Design

**Date:** 2026-06-06
**Status:** Approved
**Author:** Rizki Autentika + Claude

## Overview

A FinTech mobile app for solo and small business owners to digitize receipts and invoices. Users send receipt photos via a Telegram bot, which processes and stores them in Firebase. The Flutter app serves as a dashboard to review parsed data, search/filter receipts, and view basic financial reports.

## Target Users

Solo entrepreneurs and small business owners who want frictionless receipt capture without opening an app. They send photos via Telegram and manage their bookkeeping from the Flutter dashboard.

## Architecture

```
Telegram Bot (@yourbot)
    │  webhook (HTTPS)
    ▼
Firebase Cloud Functions (Node.js)
    ├─ telegramWebhook    — receives & routes messages
    └─ processReceipt     — OCR, parse, store
    │
    ├─ Firebase Storage (receipt images)
    ├─ Firestore (parsed receipt data)
    └─ Firebase Auth (user accounts)
    │
    ▼
Flutter App (iOS/Android)
    └─ Dashboard, receipt management, reports
```

### Key Components

1. **Telegram Bot** — registered via BotFather, uses webhook to receive photos. Handles commands (`/start`, `/link`, `/help`, `/status`) and photo messages.
2. **Firebase Cloud Functions** — the bridge between Telegram and Firebase. Two functions: a webhook handler and a receipt processor.
3. **Firebase Firestore** — stores users, receipts, and linking codes.
4. **Firebase Storage** — stores original receipt images.
5. **Firebase Auth** — email/password or Google Sign-in for Flutter app login.
6. **Flutter App** — pure frontend consuming Firestore data. Dashboard, receipt list, detail view, reports.

### OCR Strategy

On-device OCR (ML Kit) was the initial preference, but since images arrive server-side via Telegram webhook, server-side OCR is used instead:
- **Tesseract.js** runs inside Cloud Functions on the received image
- Regex-based parsing extracts structured fields (merchant, amount, date, items)
- If OCR confidence is low, receipt is saved with status `needs_review` for user verification in the Flutter app

## User Identity: Linking Telegram to Firebase

Since Telegram users are identified by `chat_id` and Flutter app users by Firebase UID, a linking step is required.

### Linking Flow

1. User opens Flutter app, signs in via Firebase Auth.
2. User taps "Connect Telegram" — app generates a 6-digit code, stores in Firestore under the user document.
3. User sends `/link ABC123` to the Telegram bot.
4. Cloud Function matches the code to a Firebase UID, writes `telegram_chat_id` to the user document.
5. Bot replies: "Account connected! Send me your receipts."

### Edge Cases

- Link code expires after 10 minutes.
- One Telegram account links to one Firebase account (and vice versa).
- Telegram link persists across app reinstalls (stored in Firestore).

### Firestore User Document

```
users/{firebase_uid}
  ├─ email: string
  ├─ telegram_chat_id: number | null
  ├─ link_code: string | null
  ├─ created_at: timestamp
  └─ display_name: string
```

## Receipt Data Model

```
receipts/{firebase_uid}/items/{receipt_id}
  ├─ telegram_message_id: number
  ├─ image_url: string (Firebase Storage path)
  ├─ ocr_raw_text: string
  ├─ merchant_name: string
  ├─ total_amount: number
  ├─ currency: "IDR"
  ├─ transaction_date: timestamp
  ├─ category: string (user-editable)
  ├─ items: array<{ name, qty, price }>
  ├─ status: "needs_review" | "confirmed"
  ├─ created_at: timestamp
  └─ confirmed_at: timestamp | null
```

### Receipt Status Lifecycle

- **`needs_review`** — OCR parsed the receipt, awaiting user verification in the Flutter app.
- **`confirmed`** — user reviewed and approved (or auto-confirmed if high confidence).

### Auto-categorization

Simple keyword-based rules applied during parsing:
- "bensin", "pertamax" → `transport`
- "beras", "minyak", "gula" → `supplies`
- "parkir", "tol" → `transport`
- Default → `other` (user can reclassify)

## Processing Flow

```
Photo arrives from Telegram webhook
    │
    ▼
1. Verify user — lookup telegram_chat_id in Firestore
    │  (reject if not linked)
    ▼
2. Save image to Firebase Storage
    │
    ▼
3. Run OCR — Tesseract.js on Cloud Function
    │  → raw text
    ▼
4. Parse receipt — regex extraction
    │  → merchant_name, total_amount, date, items
    ▼
5. Auto-categorize — keyword rules
    │
    ▼
6. Save to Firestore — status: "needs_review"
    │
    ▼
7. Reply to Telegram — "Receipt received: Rp 250.000
    from Toko Maju Jaya. Review in app."
```

## Flutter App Structure

### Screens

| Screen | Purpose |
|---|---|
| Login / Signup | Firebase Auth (email or Google) |
| Home | Summary cards (monthly total, category breakdown, receipt count), recent receipts list |
| Telegram Linking | Show 6-digit link code, connection status |
| Receipt List | Filter by category, date range, status. Search by merchant name. |
| Receipt Detail | Show original image, editable parsed fields, confirm/edit buttons |
| Reports | Monthly spending by category (bar chart), daily/weekly trend, CSV export |
| Settings | Profile, manage Telegram link, notification preferences |

### Navigation

Bottom navigation with two tabs: **Home** and **Reports**. All other screens accessed via push navigation.

### Key Packages

- `firebase_core`, `firebase_auth`, `cloud_firestore`, `firebase_storage`
- `fl_chart` — reports charts
- `google_mlkit_text_recognition` — optional in-app OCR for manual camera capture
- `image_picker` — manual camera capture
- `intl` — currency/date formatting

### State Management

Provider or Riverpod (developer's preference based on experience).

## Telegram Bot

### Setup

1. Message `@BotFather` → `/newbot` → get bot token.
2. Store token in Firebase Functions environment variables.
3. Deploy Cloud Functions, then call `setWebhook` pointing to the webhook function URL.
4. Bot handles commands and photo messages.

### Commands

| Command | Action |
|---|---|
| `/start` | Welcome message and instructions |
| `/link ABC123` | Connect Telegram to Firebase account |
| `/help` | Show available commands |
| `/status` | Show linked account status |
| Photo message | Trigger receipt processing |

## Error Handling

| Scenario | Response |
|---|---|
| User not linked | Bot replies: "Please link your account first. Open the Smart Business app and tap Connect Telegram." |
| OCR fails | Save raw image, set status `needs_review`, reply: "Could not read this receipt clearly. Please review in the app." |
| Image too large | Telegram compresses photos; Cloud Function accepts up to 20MB |
| Cloud Function timeout | OCR + parse should complete well under the 9-minute limit |

## Deployment

- Firebase Functions: `firebase deploy --only functions`
- Bot webhook: set once after function deployment
- Flutter app: standard Play Store / App Store deployment

## Future Considerations (Out of Scope for MVP)

- WhatsApp Business API integration (same webhook pattern, add as second channel)
- Export to accounting software (Xero, QuickBooks, Wave)
- Multi-user/company accounts (employee expense tracking)
- Multi-currency support
- Receipt deduplication (image similarity)
