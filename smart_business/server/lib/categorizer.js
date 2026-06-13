const CATEGORY_RULES = [
  { keywords: ["bensin", "pertamax", "solar", "bbm"], category: "transport" },
  { keywords: ["parkir", "tol", "parking"], category: "transport" },
  { keywords: ["beras", "minyak", "gula", "tepung", "telur"], category: "supplies" },
  { keywords: ["makan", "nasi", "ayam", "kopi", "resto", "cafe"], category: "food" },
  { keywords: ["pln", "listrik", "pdam", "air", "internet", "wifi"], category: "utilities" },
  { keywords: ["atk", "kertas", "printer", "toner", "pensil"], category: "office" },
];

function categorize(merchantName, rawText) {
  const text = `${merchantName} ${rawText}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return rule.category;
      }
    }
  }
  return "other";
}

module.exports = { categorize };
