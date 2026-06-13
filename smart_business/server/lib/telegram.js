const axios = require("axios");

const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotUrl(token) {
  return `${TELEGRAM_API}${token}`;
}

async function sendMessage(token, chatId, text, parseMode = "Markdown") {
  return axios.post(`${getBotUrl(token)}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });
}

async function getFileUrl(token, fileId) {
  const response = await axios.get(`${getBotUrl(token)}/getFile`, {
    params: { file_id: fileId },
  });
  const filePath = response.data.result.file_path;
  return `${TELEGRAM_API}${token}/${filePath}`;
}

module.exports = { sendMessage, getFileUrl, getBotUrl };
