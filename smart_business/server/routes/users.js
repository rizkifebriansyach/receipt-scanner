const express = require("express");

const { requireAuth } = require("../lib/auth");
const usersRepo = require("../lib/repositories/users");

const router = express.Router();

/**
 * @openapi
 * /users/telegram-link:
 *   post:
 *     tags: [Users]
 *     summary: Generate a Telegram link code
 *     description: |
 *       Generates a 6-character code that the user sends to the Telegram bot
 *       via `/link <code>` to connect their Telegram account. The code expires
 *       in 5 minutes. If the account is already linked to Telegram, returns an
 *       error.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Link code generated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 link_code: { type: string, example: "ABC123" }
 *                 expires_at: { type: string, format: "date-time" }
 *       400:
 *         description: Account already linked to Telegram.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 message: { type: string }
 *       401: { description: Missing or invalid bearer token }
 */
router.post("/telegram-link", requireAuth, async (req, res) => {
  try {
    await usersRepo.upsertFromFirebase({
      firebase_uid: req.user.uid,
      email: req.user.email,
    });

    const status = await usersRepo.getLinkStatus(req.user.uid);
    if (status.linked) {
      return res.status(400).json({
        error: "already_linked",
        message: "Account already linked to Telegram.",
      });
    }

    const result = await usersRepo.generateLinkCode(req.user.uid);
    res.status(200).json(result);
  } catch (error) {
    console.error("Generate link code error:", error);
    res.status(500).json({ error: "internal" });
  }
});

/**
 * @openapi
 * /users/telegram-link/status:
 *   get:
 *     tags: [Users]
 *     summary: Check Telegram link status
 *     description: |
 *       Returns whether the authenticated user has linked their Telegram account
 *       and whether there is a pending (unexpired) link code.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Link status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 linked: { type: boolean }
 *                 has_pending_code: { type: boolean }
 *       401: { description: Missing or invalid bearer token }
 */
router.get("/telegram-link/status", requireAuth, async (req, res) => {
  try {
    await usersRepo.upsertFromFirebase({
      firebase_uid: req.user.uid,
      email: req.user.email,
    });

    const status = await usersRepo.getLinkStatus(req.user.uid);
    res.status(200).json(status);
  } catch (error) {
    console.error("Get link status error:", error);
    res.status(500).json({ error: "internal" });
  }
});

module.exports = router;
