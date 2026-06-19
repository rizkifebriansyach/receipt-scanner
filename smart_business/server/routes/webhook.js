const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const { sendMessage, getFileUrl } = require("../lib/telegram");
const { extractText } = require("../lib/ocr");
const { parseReceiptText } = require("../lib/parser");
const { categorize } = require("../lib/categorizer");
const usersRepo = require("../lib/repositories/users");
const receiptsRepo = require("../lib/repositories/receipts");
const storage = require("../lib/storage");

const router = express.Router();

async function findUserByTelegramChatId(chatId) {
  return usersRepo.findByTelegramChatId(chatId);
}

async function handleStart(BOT_TOKEN, chatId) {
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
      "/status — Check connection status"
  );
}

async function handleLink(BOT_TOKEN, chatId, code) {
  const user = await usersRepo.findByLinkCode(code);
  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Invalid or expired code. Please open the Smart Business app and generate a new link code."
    );
    return;
  }
  if (user.telegram_chat_id) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "This account is already linked to a Telegram account."
    );
    return;
  }
  await usersRepo.linkTelegram(user.firebase_uid, chatId);
  await sendMessage(
    BOT_TOKEN,
    chatId,
    "Account connected! You can now send me receipt and invoice photos."
  );
}

async function handleStatus(BOT_TOKEN, chatId) {
  const user = await findUserByTelegramChatId(chatId);
  if (!user) {
    await sendMessage(BOT_TOKEN, chatId, "No account linked. Send /link <code> to connect.");
  } else {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      `Account linked to: ${user.email || user.display_name}`
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

async function handlePhoto(BOT_TOKEN, message) {
  const chatId = message.chat.id;
  const user = await findUserByTelegramChatId(chatId);

  if (!user) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Please link your account first. Open the Smart Business app and tap Connect Telegram."
    );
    return;
  }

  const photo = message.photo[message.photo.length - 1];
  const fileId = photo.file_id;

  await sendMessage(BOT_TOKEN, chatId, "Processing your receipt...");

  try {
    const imageUrl = await getFileUrl(BOT_TOKEN, fileId);
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
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
      "Receipt received! I'll process it and you can review it in the app."
    );
  } catch (error) {
    console.error("Receipt processing error:", error);
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "Something went wrong processing your receipt. Please try again or send a clearer photo."
    );
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

router.post("/", express.json(), async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) {
      return res.status(200).send("No message");
    }

    const text = message.text || "";
    const chatId = message.chat.id;

    if (text.startsWith("/start")) {
      await handleStart(BOT_TOKEN, chatId);
    } else if (text.startsWith("/link")) {
      const code = text.split(" ")[1]?.trim();
      if (!code) {
        await sendMessage(
          BOT_TOKEN,
          chatId,
          "Usage: /link <code>\nGenerate a code in the Smart Business app."
        );
      } else {
        await handleLink(BOT_TOKEN, chatId, code);
      }
    } else if (text.startsWith("/help")) {
      await handleStart(BOT_TOKEN, chatId);
    } else if (text.startsWith("/status")) {
      await handleStatus(BOT_TOKEN, chatId);
    } else if (message.photo) {
      await handlePhoto(BOT_TOKEN, message);
    } else {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "Send me a receipt photo or type /help for commands."
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Internal error");
  }
});

module.exports = router;
