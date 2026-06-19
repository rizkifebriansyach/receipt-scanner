require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("./lib/firebase");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const db = getFirestore();

const { sendMessage, getFileUrl } = require("./lib/telegram");
const { extractText } = require("./lib/ocr");
const { parseReceiptText } = require("./lib/parser");
const { categorize } = require("./lib/categorizer");
const storage = require("./lib/storage");
const receiptsRepo = require("./lib/repositories/receipts");
const crypto = require("crypto");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const usersRepo = require("./lib/repositories/users");

async function findUserByTelegramChatId(chatId) {
  return await usersRepo.findByTelegramChatId(chatId);
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

app.post("/webhook", express.json(), async (req, res) => {
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
  const snapshot = await db.collectionGroup("items")
    .where("status", "==", "processing")
    .get();
  if (snapshot.empty) {
    console.log("No stuck receipts to recover");
    return;
  }
  const BATCH_LIMIT = 500;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((doc) => batch.update(doc.ref, { status: "needs_review" }));
    await batch.commit();
  }
  console.log(`Recovered ${snapshot.size} stuck receipts`);
}

recoverStuckProcessingReceipts().catch(console.error);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
