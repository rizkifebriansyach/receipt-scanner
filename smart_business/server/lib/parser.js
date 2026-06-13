function parseReceiptText(rawText) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const merchantName = lines[0] || "Unknown Merchant";

  const amountPatterns = [
    /(?:Rp\.?\s?)([\d.]+(?:,\d{2})?)/gi,
    /(?:TOTAL|Total|total)\s*:?\s*(?:Rp\.?\s?)([\d.]+)/i,
    /(?:TOTAL|Total|total)\s*:?\s*([\d.]+)/i,
  ];

  let totalAmount = 0;
  for (const line of lines) {
    for (const pattern of amountPatterns) {
      const match = pattern.exec(line);
      if (match) {
        const raw = match[1] || match[0].replace(/[^0-9,]/g, "");
        const cleaned = raw.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(cleaned);
        if (num > totalAmount) {
          totalAmount = num;
        }
      }
    }
  }

  let transactionDate = null;
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  for (const line of lines) {
    const match = datePattern.exec(line);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += 2000;
      transactionDate = new Date(year, month, day);
      break;
    }
  }

  const items = [];
  const itemPattern = /^(.+?)\s+(\d+)\s+(?:x\s+)?(?:Rp\.?\s?)([\d.]+)$/i;
  for (const line of lines.slice(1)) {
    const match = itemPattern.exec(line);
    if (match) {
      items.push({
        name: match[1].trim(),
        qty: parseInt(match[2]),
        price: parseFloat(match[3].replace(/\./g, "")),
      });
    }
  }

  return {
    merchantName,
    totalAmount: Math.round(totalAmount),
    transactionDate,
    items,
    rawText,
  };
}

module.exports = { parseReceiptText };
