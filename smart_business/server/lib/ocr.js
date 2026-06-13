const Tesseract = require("tesseract.js");

async function extractText(imageBuffer) {
  const worker = await Tesseract.createWorker("eng+ind");
  const { data } = await worker.recognize(imageBuffer);
  await worker.terminate();
  return data.text;
}

module.exports = { extractText };
