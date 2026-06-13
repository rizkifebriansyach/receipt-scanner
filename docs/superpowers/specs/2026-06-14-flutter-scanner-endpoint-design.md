# Flutter Scanner Endpoint — Backend Design

**Date:** 2026-06-14
**Status:** Approved
**Author:** Rizki Autentika + Claude
**Depends on:** `2026-06-06-receipt-scanner-telegram-design.md` (existing backend)

## Overview

Tambah endpoint HTTP di backend Express.js yang sudah ada, agar Flutter app bisa mengirim foto receipt dan mendapatkan hasil OCR yang **konsisten** dengan flow Telegram. Menggunakan Tesseract.js server-side yang sama, parser regex yang sama, dan categorizer yang sama — supaya data dari kedua channel tidak berbeda hasil.

Flutter capture foto → kirim ke `POST /scan-receipt` → backend jalanin OCR + parse + categorize → simpan ke Firestore → Flutter pantau via stream.

## Architecture

```
Flutter App                    Express Server                 Firestore
    │                              │                              │
    │  POST /scan-receipt          │                              │
    │  Authorization: Bearer <id>  │                              │
    │  { image_base64 }            │                              │
    ├─────────────────────────────>│                              │
    │                              │  verifyIdToken(id)           │
    │                              │  ├─ valid? ── no ── 401      │
    │                              │  │           yes             │
    │                              │  ├─ create doc status='processing'
    │                              │  └──────────────────────────>│
    │  200 { receipt_id }          │                              │
    │<─────────────────────────────│                              │
    │                              │  ┌── fire & forget ──┐       │
    │                              │  │ extractText()     │       │
    │                              │  │ parseReceiptText()│       │
    │                              │  │ categorize()      │       │
    │                              │  └───────────────────┘       │
    │                              │  update doc: status='needs_review'
    │                              │─────────────────────────────>│
    │                                                              │
    │  watch stream receipts/{uid}/items                           │
    │<───────────────────────────── stream update ─────────────────│
```

**Key points:**

- Endpoint `POST /scan-receipt` hidup berdampingan dengan `POST /webhook` (Telegram). Tidak ada perubahan pada flow Telegram.
- Modul existing `lib/ocr.js`, `lib/parser.js`, `lib/categorizer.js` dipakai ulang apa adanya — pure functions yang tidak peduli source image.
- Auth pakai Firebase Admin SDK `admin.auth().verifyIdToken(token)` — sudah tersedia di `index.js`, no extra dependency.
- **Async pattern:** setelah `res.json()`, Promise OCR jalan di background Node event loop. HTTP request selesai, koneksi tutup, tapi Node process tetap aktif sampai OCR selesai dan update Firestore.

## API Contract

### Request

```
POST /scan-receipt
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "image_base64": "<base64-encoded JPEG/PNG>"
}
```

### Response (sukses, 200)

```json
{
  "receipt_id": "xYz123abc...",
  "status": "processing"
}
```

Returned **sebelum** OCR selesai. Flutter lanjut pantau stream Firestore sampai status berubah ke `needs_review`.

### Response (error)

| Status | Kapan | Body |
|---|---|---|
| 401 | Token invalid/expired/tidak ada | `{ "error": "unauthorized", "message": "..." }` |
| 400 | Body bukan JSON valid / `image_base64` kosong | `{ "error": "bad_request", "message": "..." }` |
| 413 | Body > 10MB (limit Express) | `{ "error": "payload_too_large" }` |
| 500 | Error tak terduga (Firestore down, dll) | `{ "error": "internal" }` |

### Express body limit

Endpoint ini butuh limit body lebih besar dari default Express (100kb). Set per-route:

```javascript
app.post("/scan-receipt", express.json({ limit: "10mb" }), handler);
```

Endpoint `/webhook` tetap default (Telegram payload kecil, < 100kb).

## Firestore Document Schema

### Field lengkap saat doc dibuat (status='processing')

```javascript
{
  source: "flutter",              // "flutter" | "telegram"
  telegram_message_id: null,      // null untuk source flutter
  image_base64: "<string>",
  ocr_raw_text: "",               // kosong sampai OCR selesai
  merchant_name: "",              // kosong sampai OCR selesai
  total_amount: 0,
  currency: "IDR",
  transaction_date: null,         // null eksplisit, siap input manual via Flutter
  category: "other",
  items: [],
  status: "processing",
  created_at: Timestamp,
  confirmed_at: null,
}
```

Field `transaction_date` sengaja di-set `null` eksplisit dari awal, bukan dihilangkan. Tujuannya: Flutter bisa langsung tampilkan date picker di form edit terlepas OCR sukses/gagal/crash.

### Field setelah OCR sukses (status='needs_review')

```javascript
{
  ocr_raw_text: "<hasil Tesseract>",
  merchant_name: "<dari parser>",
  total_amount: <number>,
  transaction_date: Timestamp | null,  // Timestamp kalau parser nemu, null kalau tidak
  category: "<hasil categorizer>",
  items: [{ name, qty, price }, ...],
  status: "needs_review",
}
```

### Field setelah OCR gagal atau crash recovery (status='needs_review')

```javascript
{
  status: "needs_review",
  // Field lain tetap seperti saat doc dibuat:
  // ocr_raw_text="", merchant_name="", total_amount=0, transaction_date=null
}
```

### Backfill ke handler Telegram

Untuk konsistensi, handler `handlePhoto` di `index.js` juga tambah field `source: "telegram"` saat create doc.

## Error Handling & Edge Cases

### 1. Server crash saat OCR berjalan

**Masalah:** Doc tertinggal status `'processing'` selamanya. Flutter stream lihat doc tapi nggak pernah berubah status.

**Solusi: Startup recovery hook** — jalan sekali saat server start:

```javascript
async function recoverStuckProcessingReceipts() {
  const snapshot = await db.collectionGroup("items")
    .where("status", "==", "processing")
    .get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "needs_review" });
  });
  await batch.commit();
  console.log(`Recovered ${snapshot.size} stuck receipts`);
}

// Sebelum app.listen():
recoverStuckProcessingReceipts().catch(console.error);
```

Doc yang stuck di-reset ke `needs_review`. Field OCR tetap kosong, user input manual via Flutter.

### 2. OCR throw error (Tesseract crash, corrupted image)

Handler background process:

```javascript
async function processReceiptInBackground(receiptRef, imageBase64) {
  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const rawText = await extractText(imageBuffer);
    const parsed = parseReceiptText(rawText);
    const category = categorize(parsed.merchantName, rawText);

    await receiptRef.update({
      ocr_raw_text: rawText,
      merchant_name: parsed.merchantName,
      total_amount: parsed.totalAmount,
      transaction_date: parsed.transactionDate
        ? Timestamp.fromDate(parsed.transactionDate) : null,
      category,
      items: parsed.items,
      status: "needs_review",
    });
  } catch (error) {
    console.error("OCR processing failed for", receiptRef.id, error);
    await receiptRef.update({
      status: "needs_review",
      // field lain tetap default value dari initial creation
    });
  }
}
```

Sesuai keputusan: error → status tetap `needs_review`, field OCR dikosongkan, gambar tetap tersimpan. User lihat gambar + edit manual di Flutter (termasuk date picker untuk `transaction_date`).

### 3. Token valid tapi doc `users/{uid}` belum ada

**Kondisi:** `verifyIdToken` sukses (UID Firebase Auth valid), tapi doc `users/{uid}` belum ada — misalnya signup lewat Firebase Auth tapi belum trigger pembuatan doc.

**Handling:** Tetap izinkan. UID dari token cukup untuk tulis receipts (path `receipts/{uid}/items/`). Telegram flow juga tidak butuh doc `users` untuk tulis receipts — cuma butuh doc `users` untuk **link** akun Telegram.

### 4. Image bukan receipt / tidak terbaca OCR

Tesseract tidak crash pada gambar non-receipt — dia tetap return text (mungkin garbage). Parser regex tidak match → `total_amount: 0`, `merchant_name: ""`. Doc tetap disimpan dengan status `needs_review`. User hapus manual di Flutter.

Tidak perlu pre-validation image — biarkan OCR + user yang filter.

### 5. Concurrent requests dari user yang sama

Tidak ada locking. Dua request bersamaan → dua doc terbuat, dua OCR jalan paralel di event loop. Fine untuk use case solo user.

## Implementation Approach

**Dipilih: In-process Promise (fire-and-forget)**

```javascript
app.post("/scan-receipt", express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });
    }
    const idToken = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
    }

    const { image_base64 } = req.body;
    if (!image_base64 || typeof image_base64 !== "string") {
      return res.status(400).json({ error: "bad_request", message: "image_base64 required" });
    }

    const uid = decoded.uid;
    const receiptRef = db.collection("receipts").doc(uid).collection("items").doc();

    await receiptRef.set({
      source: "flutter",
      telegram_message_id: null,
      image_base64,
      ocr_raw_text: "",
      merchant_name: "",
      total_amount: 0,
      currency: "IDR",
      transaction_date: null,
      category: "other",
      items: [],
      status: "processing",
      created_at: Timestamp.now(),
      confirmed_at: null,
    });

    res.status(200).json({ receipt_id: receiptRef.id, status: "processing" });

    // Fire-and-forget — tidak di-await
    processReceiptInBackground(receiptRef, image_base64).catch((err) =>
      console.error("Background OCR failed:", err)
    );
  } catch (error) {
    console.error("Scan receipt error:", error);
    res.status(500).json({ error: "internal" });
  }
});
```

**Alasan pilihan in-process Promise:**

1. User-nya solo business owner — volume rendah, 1-2 foto per menit puncaknya
2. Server jalan lokal (di laptop user), crash jarang terjadi
3. Konsisten dengan gaya kode existing (`handlePhoto` di `index.js` juga async fire-and-forget style)
4. YAGNI — kalau nanti butuh retry/queue, bisa di-upgrade tanpa breaking API contract

## Out of Scope (YAGNI)

Hal-hal yang sengaja **tidak** diimplementasi di spec ini:

- ❌ Retry OCR otomatis saat gagal
- ❌ Rate limiting per user
- ❌ Queue/concurrency control (job queue, worker pool)
- ❌ Image validation (format, dimension, file signature)
- ❌ Deduplikasi foto (user kirim 2x gambar yang sama)
- ❌ Endpoint GET `/receipts/:id` atau PATCH untuk edit — Flutter already handles via Firestore SDK langsung
- ❌ WebSocket / SSE untuk push notification — Flutter sudah pakai Firestore stream

## Security Considerations

- **Auth wajib:** Setiap request harus sertakan Firebase ID token. Token diverifikasi via Admin SDK. Tanpa token valid → 401.
- **UID isolation:** Receipts ditulis ke `receipts/{uid}/items/` dimana `uid` dari decoded token, BUKAN dari request body. User A tidak bisa tulis ke receipts User B.
- **Firestore rules:** Sudah ada di `firestore.rules` line 7-9: `allow read, write: if request.auth != null && request.auth.uid == userId`. Backend pakai Admin SDK yang bypass rules, tapi Flutter side tetap di-batas oleh rules ini.
- **Body size limit:** 10MB. Mencegah abuse upload file besar yang bisa habisin memory.
- **Tidak log image_base64:** Image base64 besar (~MB-an), tidak boleh di-log di `console.error`. Logging hanya untuk metadata (receipt_id, error message).

## Files Affected

| File | Change |
|---|---|
| `smart_business/server/index.js` | Tambah endpoint `/scan-receipt`, fungsi `processReceiptInBackground`, fungsi `recoverStuckProcessingReceipts`, panggil recovery hook sebelum `app.listen()`. Tambah `source: "telegram"` di handler `handlePhoto` existing. |

Tidak ada file baru. Tidak ada perubahan ke `lib/telegram.js`, `lib/ocr.js`, `lib/parser.js`, `lib/categorizer.js` — semua dipakai apa adanya.

## Testing Strategy

Karena server jalan manual (bukan CI/CD), testing dilakukan via curl/Postman setelah server start:

1. **Auth gagal:** `curl -X POST http://localhost:3000/scan-receipt` tanpa Authorization header → expect 401
2. **Token invalid:** Authorization: Bearer garbage → expect 401
3. **Body kosong:** Token valid, body `{}` → expect 400
4. **Happy path:** Token valid + image_base64 kecil → expect 200 + receipt_id. Cek Firestore, doc baru muncul dengan status `processing`, lalu beberapa detik kemudian status berubah ke `needs_review` dengan field OCR terisi.
5. **Crash recovery:** Stop server paksa (Ctrl+C) saat ada doc status `processing`. Start server lagi → expect doc berubah jadi `needs_review` otomatis.

## Future Considerations (Out of Scope)

- Multipart upload (lebih efisien untuk image besar) — kalau base64 10MB terbukti bermasalah
- Real job queue (Bull/BullMQ) kalau volume naik atau butuh retry
- Webhook signature verification (HMAC) kalau Flutter butuh non-Firebase auth alternative
- Image preprocessing server-side (resize, contrast adjustment) untuk improve OCR accuracy
