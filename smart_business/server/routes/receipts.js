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
