require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const receiptsRepo = require("./lib/repositories/receipts");
const swaggerSpec = require("./lib/swagger");

const webhookRoutes = require("./routes/webhook");
const scanReceiptRoutes = require("./routes/scanReceipt");
const receiptsRoutes = require("./routes/receipts");
const usersRoutes = require("./routes/users");

const PORT = process.env.PORT || 3000;

const app = express();

app.use("/webhook", webhookRoutes);
app.use("/scan-receipt", scanReceiptRoutes);
app.use("/receipts", receiptsRoutes);
app.use("/users", usersRoutes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

app.get("/", (req, res) => {
  res.send("Smart Business Receipt Scanner server is running.");
});

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
  const count = await receiptsRepo.markStuckAsNeedsReview();
  if (count > 0) {
    console.log(`Recovered ${count} stuck receipts`);
  } else {
    console.log("No stuck receipts to recover");
  }
}

recoverStuckProcessingReceipts().catch(console.error);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
