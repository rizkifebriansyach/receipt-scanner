const express = require("express");
const crypto = require("crypto");

const { extractText } = require("../lib/ocr");
const { parseReceiptText } = require("../lib/parser");
const { categorize } = require("../lib/categorizer");
const { requireAuth } = require("../lib/auth");
const usersRepo = require("../lib/repositories/users");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");

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

/**
 * @openapi
 * /scan-receipt:
 *   post:
 *     tags: [Scan]
 *     summary: Upload a receipt image for OCR processing
 *     description: |
 *       Accepts a base64-encoded image from the mobile app, stores it in MinIO,
 *       creates a receipt row in `processing` state, and runs OCR asynchronously.
 *       The mobile app polls `GET /receipts/{receipt_id}` until `status` changes
 *       to `needs_review` (success) or remains stuck at `processing` (failure).
 *
 *       The user is upserted from the Firebase ID token claims so the `user_id`
 *       foreign key is satisfied.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/ScanReceiptRequest" }
 *     responses:
 *       200:
 *         description: Receipt accepted; OCR running in background.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ScanReceiptResponse" }
 *       400: { description: Missing or invalid image_base64, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       401: { description: Missing or invalid bearer token, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       413: { description: Payload too large (max 10MB), content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 */
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
