# Flutter Scanner Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah endpoint `POST /scan-receipt` di Express server backend agar Flutter app bisa mengirim foto receipt dan dapat processing yang konsisten dengan flow Telegram (OCR Tesseract.js + parser + categorizer yang sama).

**Architecture:** Endpoint menerima Firebase ID token + image base64, verifikasi token via Admin SDK, tulis doc Firestore dengan status `'processing'`, return receipt_id langsung. OCR berjalan async (fire-and-forget Promise) di background Node event loop, update doc ke `'needs_review'` saat selesai. Startup recovery hook reset doc yang tertinggal `'processing'` karena server crash.

**Tech Stack:** Express.js 5.x, firebase-admin 14.x, Tesseract.js 7.x, Firestore, Firebase Auth.

**Spec:** `docs/superpowers/specs/2026-06-14-flutter-scanner-endpoint-design.md`

**Prasyarat:** Backend server sudah berjalan (`smart_business/server/`), `serviceAccountKey.json` sudah ada di folder server, `.env` sudah berisi `TELEGRAM_BOT_TOKEN`. Project ini belum git repo — `git init` dulu sebelum commit, atau skip commit steps.

---

## File Structure

Semua perubahan di **satu file**: `smart_business/server/index.js`. Tidak ada file baru. Modul existing (`lib/ocr.js`, `lib/parser.js`, `lib/categorizer.js`, `lib/telegram.js`) tidak diubah — dipakai apa adanya.

| Lokasi di `index.js` | Apa yang ditambah/ubah |
|---|---|
| Fungsi `handlePhoto` (sekitar line 159-174) | Tambah field `source: "telegram"` di `receiptRef.set({...})` |
| Setelah fungsi `handlePhoto`, sebelum `app.post("/webhook")` | Fungsi baru `processReceiptInBackground(receiptRef, imageBase64)` |
| Setelah `app.get("/")`, sebelum `app.listen` | Fungsi baru `recoverStuckProcessingReceipts()` |
| Setelah `app.post("/webhook")` atau setelah `app.get("/")` | Route baru `app.post("/scan-receipt", ...)` |
| Sebelum `app.listen(PORT, ...)` | Panggilan `recoverStuckProcessingReceipts().catch(console.error)` |

---

## Task 1: Backfill `source` field di handler Telegram

**Files:**
- Modify: `smart_business/server/index.js` (di dalam fungsi `handlePhoto`)

Tujuan: Tambah field `source: "telegram"` ke doc receipts yang dibuat oleh flow Telegram, supaya konsisten dengan doc yang akan dibuat oleh endpoint Flutter. Field ini dipakai untuk distinguir source saat debugging atau analitik.

- [ ] **Step 1: Edit `receiptRef.set({...})` di `handlePhoto`**

Buka `smart_business/server/index.js`, cari blok `await receiptRef.set({` di dalam fungsi `handlePhoto` (sekitar line 159). Tambahkan baris `source: "telegram",` di awal object:

```javascript
    await receiptRef.set({
      source: "telegram",
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
```

- [ ] **Step 2: Restart server dan kirim photo via Telegram untuk verifikasi**

```bash
cd smart_business/server
node index.js
```

Kirim foto receipt ke bot Telegram yang sudah ter-link. Buka Firebase Console → Firestore → `receipts/{uid}/items/{receiptId}` → verify field `source: "telegram"` ada di doc baru.

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/index.js
git commit -m "feat(backfill): add source field to telegram-created receipts"
```

---

## Task 2: Background processor function + Startup recovery hook

**Files:**
- Modify: `smart_business/server/index.js`

Tujuan: Tambah dua fungsi baru:
1. `processReceiptInBackground(receiptRef, imageBase64)` — function yang akan dipanggil endpoint `/scan-receipt` untuk jalanin OCR + parse + categorize di background.
2. `recoverStuckProcessingReceipts()` — function yang jalan sekali saat server start, reset semua doc status `'processing'` (yang tertinggal karena crash) ke `'needs_review'`.

- [ ] **Step 1: Tambah fungsi `processReceiptInBackground`**

Di `smart_business/server/index.js`, tambahkan fungsi baru ini **setelah** fungsi `handlePhoto` berakhir (sekitar line 197, sebelum `app.post("/webhook")`):

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
        ? Timestamp.fromDate(parsed.transactionDate)
        : null,
      category,
      items: parsed.items,
      status: "needs_review",
    });
  } catch (error) {
    console.error("OCR processing failed for", receiptRef.id, error);
    await receiptRef.update({
      status: "needs_review",
    });
  }
}
```

- [ ] **Step 2: Tambah fungsi `recoverStuckProcessingReceipts`**

Di file yang sama, tambahkan fungsi ini **sebelum** `app.listen(PORT, ...)` (bisa diletakkan setelah `app.get("/")`):

```javascript
async function recoverStuckProcessingReceipts() {
  const snapshot = await db.collectionGroup("items")
    .where("status", "==", "processing")
    .get();
  if (snapshot.empty) {
    console.log("No stuck receipts to recover");
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "needs_review" });
  });
  await batch.commit();
  console.log(`Recovered ${snapshot.size} stuck receipts`);
}
```

- [ ] **Step 3: Panggil recovery hook sebelum `app.listen`**

Cari baris `app.listen(PORT, () => {` di akhir file. Tambahkan pemanggilan recovery hook **tepat sebelumnya**:

```javascript
recoverStuckProcessingReceipts().catch(console.error);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 4: Test recovery hook secara manual**

Untuk verifikasi hook jalan:

1. Buka Firebase Console → Firestore → pilih satu doc di `receipts/{uid}/items/` → edit field `status` dari `needs_review` jadi `processing` (atau buat doc baru dengan status `processing`).
2. Restart server:

```bash
cd smart_business/server
node index.js
```

3. Cek log console — harus muncul `Recovered 1 stuck receipts` (atau sesuai jumlah doc yang diubah).
4. Verify di Firestore — doc yang tadi di-set `processing` sekarang kembali `needs_review`.

- [ ] **Step 5: Commit**

```bash
git add smart_business/server/index.js
git commit -m "feat: add background OCR processor and startup recovery hook"
```

---

## Task 3: Endpoint `POST /scan-receipt`

**Files:**
- Modify: `smart_business/server/index.js`

Tujuan: Tambah route `POST /scan-receipt` dengan auth Firebase ID token, body limit 10MB, doc creation dengan status `'processing'`, return receipt_id, lalu fire-and-forget background processing.

- [ ] **Step 1: Tambah route `POST /scan-receipt`**

Di `smart_business/server/index.js`, tambahkan route baru ini **setelah** `app.post("/webhook", ...)` block (atau setelah `app.get("/")`):

```javascript
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
      const receiptRef = db
        .collection("receipts")
        .doc(uid)
        .collection("items")
        .doc();

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

      processReceiptInBackground(receiptRef, image_base64).catch((err) =>
        console.error("Background OCR failed:", err)
      );
    } catch (error) {
      console.error("Scan receipt error:", error);
      res.status(500).json({ error: "internal" });
    }
  }
);
```

**Catatan penting tentang `express.json({ limit: "10mb" })` di route ini:** Express 5.x mengizinkan middleware diberikan sebagai argumen kedua `app.post(path, middleware, handler)`. Ini membuat body limit 10MB hanya berlaku untuk endpoint `/scan-receipt`, tidak untuk endpoint lain (termasuk `/webhook` yang tetap default 100kb).

- [ ] **Step 2: Restart server**

```bash
cd smart_business/server
node index.js
```

Verify tidak ada error syntax. Log harus muncul: `Server running on port 3000` dan `Recovered N stuck receipts` (atau `No stuck receipts to recover`).

- [ ] **Step 3: Commit**

```bash
git add smart_business/server/index.js
git commit -m "feat: add POST /scan-receipt endpoint with Firebase auth and async OCR"
```

---

## Task 4: Manual integration testing

**Files:**
- Tidak ada perubahan code. Hanya verifikasi.

Tujuan: Verifikasi semua 5 skenario dari spec testing strategy berjalan benar. Setup yang dibutuhkan: server jalan, akun Firebase Auth test user (signup via Firebase Console atau via Flutter app kalau sudah ada), `serviceAccountKey.json` valid.

- [ ] **Step 1: Dapatkan Firebase ID token untuk testing**

Pilih salah satu:

**Opsi A — via Firebase Console (REPL Auth):** Firebase Console → Authentication → Users → pilih user → tidak ada cara langsung dapat ID token dari UI, jadi pakai Opsi B.

**Opsi B — via curl dengan REST API:**

```bash
curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_WEB_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "returnSecureToken": true
  }' | jq -r '.idToken'
```

Ganti `<FIREBASE_WEB_API_KEY>` dengan API key dari Firebase Console → Project Settings → General → Web API Key. Simpan token output ke variabel:

```bash
TOKEN="copy-token-from-output-here"
```

- [ ] **Step 2: Test 401 — tanpa Authorization header**

```bash
curl -i -X POST http://localhost:3000/scan-receipt \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "test"}'
```

**Expected:** HTTP 401 dengan body `{"error":"unauthorized","message":"Missing bearer token"}`.

- [ ] **Step 3: Test 401 — token invalid**

```bash
curl -i -X POST http://localhost:3000/scan-receipt \
  -H "Authorization: Bearer garbage_token" \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "test"}'
```

**Expected:** HTTP 401 dengan body `{"error":"unauthorized","message":"Invalid token"}`.

- [ ] **Step 4: Test 400 — body kosong**

```bash
curl -i -X POST http://localhost:3000/scan-receipt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** HTTP 400 dengan body `{"error":"bad_request","message":"image_base64 required"}`.

- [ ] **Step 5: Test happy path — sukses dengan image kecil**

Siapkan image kecil (< 100KB) sebagai base64. Cara dapatkan base64 dari file gambar lokal:

```bash
IMAGE_B64=$(base64 -i receipt_sample.jpg)
curl -i -X POST http://localhost:3000/scan-receipt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\": \"$IMAGE_B64\"}"
```

**Expected:**
- Response immediate: HTTP 200 dengan body `{"receipt_id":"<id>","status":"processing"}`
- Cek Firestore Console segera setelah response: doc baru muncul di `receipts/{uid}/items/{receiptId}` dengan `status: "processing"` dan semua field OCR kosong/default.
- Tunggu 5-30 detik. Refresh Firestore doc — `status` harus berubah jadi `"needs_review"`, field `ocr_raw_text`, `merchant_name`, `total_amount`, `category`, `items` terisi hasil OCR.
- Field `source` harus `"flutter"`.

- [ ] **Step 6: Test crash recovery**

1. Stop server dengan `Ctrl+C` saat ada doc yang statusnya masih `'processing'` (buat doc baru lalu langsung stop server sebelum 30 detik).

   Atau alternative: pakai Firebase Console → edit salah satu doc → set `status` ke `"processing"` manual.

2. Start server lagi:

```bash
node index.js
```

3. **Expected:** Log console muncul `Recovered 1 stuck receipts` (atau sesuai jumlah). Cek Firestore — doc yang tadi `"processing"` sekarang `"needs_review"`. Field OCR tetap kosong (karena OCR emang nggak sempat jalan), user bisa input manual via Flutter.

- [ ] **Step 7: Final commit (jika ada perubahan)**

Seharusnya tidak ada perubahan code di task ini. Skip step kalau semua test pass tanpa perubahan.

Kalau ada bug yang perlu fix di code:

```bash
git add smart_business/server/index.js
git commit -m "fix: <deskripsi fix berdasarkan temuan testing>"
```

---

## Summary

| Task | Apa yang dibangun | Verifikasi |
|---|---|---|
| Task 1 | Field `source: "telegram"` di handler existing | Kirim photo via Telegram, cek Firestore |
| Task 2 | `processReceiptInBackground` + `recoverStuckProcessingReceipts` + call hook | Set doc status `processing` manual, restart server, verify reset |
| Task 3 | Endpoint `POST /scan-receipt` dengan auth, body limit 10MB, async OCR | curl dengan token valid, verify doc status berubah dari `processing` ke `needs_review` |
| Task 4 | Manual integration test (5 skenario) | Semua skenario pass sesuai expected output |

Setelah semua task selesai, backend siap menerima request dari Flutter. Flutter side akan diimplementasi saat Flutter project dibangun (lihat plan `2026-06-06-receipt-scanner-telegram.md` Task 7+).
