const express = require("express");
const { requireAuth } = require("../lib/auth");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");

const router = express.Router();

router.use(requireAuth);

/**
 * @openapi
 * /receipts:
 *   get:
 *     tags: [Receipts]
 *     summary: List the current user's receipts
 *     description: Returns receipts newest-first, scoped to the authenticated user. Supports filtering by status, category, and transaction date range, plus pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [processing, needs_review, confirmed, rejected] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Inclusive lower bound on transaction_date (YYYY-MM-DD).
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Inclusive upper bound on transaction_date (YYYY-MM-DD).
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Receipt list.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: "#/components/schemas/Receipt" }
 *       401:
 *         description: Missing or invalid bearer token.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 */
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

/**
 * @openapi
 * /receipts/{id}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get a single receipt with its items
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The receipt with items.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Receipt" }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       404: { description: Receipt not found for this user, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 */
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

/**
 * @openapi
 * /receipts/{id}:
 *   patch:
 *     tags: [Receipts]
 *     summary: Update editable fields on a receipt
 *     description: Updates only the supplied fields. Setting `status` to `confirmed` stamps `confirmed_at`. `items` are not editable via this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/UpdateReceiptRequest" }
 *     responses:
 *       200:
 *         description: Updated receipt.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Receipt" }
 *       400: { description: No valid fields supplied, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       404: { description: Receipt not found for this user, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 */
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

/**
 * @openapi
 * /receipts/{id}/image:
 *   get:
 *     tags: [Receipts]
 *     summary: Get a short-lived signed URL for the receipt image
 *     description: Returns a 302 redirect to a MinIO presigned URL valid for 60 seconds. The mobile app should follow the redirect (or use the Location header directly).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       302:
 *         description: Redirect to presigned URL.
 *         headers:
 *           Location:
 *             schema: { type: string, format: uri }
 *             description: Presigned MinIO URL valid for 60 seconds.
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 *       404: { description: Receipt not found for this user, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
 */
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
