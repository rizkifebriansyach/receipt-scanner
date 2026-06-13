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
    console.error(`OCR processing failed for ${receiptRef.id}:`, error);
    try {
      await receiptRef.update({
        status: "needs_review",
      });
    } catch (updateError) {
      console.error(`Failed to update receipt status after OCR error for ${receiptRef.id}:`, updateError);
    }
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

async function recoverStuckProcessingReceipts() {
  const snapshot = await db.collectionGroup("items")
    .where("status", "==", "processing")
    .get();
  if (snapshot.empty) {
    console.log("No stuck receipts to recover");
    return;
  }
  // Firestore batch limit is 500 ops; acceptable for solo-user use case.
  // If this ever scales, chunk into multiple batches.
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "needs_review" });
  });
  await batch.commit();
  console.log(`Recovered ${snapshot.size} stuck receipts`);
}

recoverStuckProcessingReceipts().catch(console.error);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
