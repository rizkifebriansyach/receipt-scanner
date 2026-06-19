const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Business Receipt Scanner API",
      version: "1.0.0",
      description:
        "Backend for the Smart Business Receipt Scanner. Handles Telegram bot webhook, mobile receipt scanning with OCR, and receipt listing/editing for the mobile app.",
    },
    servers: [
      { url: "/", description: "Relative to server root" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Firebase Auth ID token. Obtained by the mobile app after sign-in via Firebase Auth.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        ReceiptItem: {
          type: "object",
          properties: {
            id: { type: "integer", format: "int64" },
            receipt_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            qty: { type: "integer", minimum: 1 },
            price: { type: "integer", format: "int64" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Receipt: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string" },
            source: {
              type: "string",
              enum: ["telegram", "flutter"],
            },
            telegram_message_id: { type: "integer", nullable: true },
            image_path: { type: "string" },
            ocr_raw_text: { type: "string" },
            merchant_name: { type: "string" },
            total_amount: { type: "integer", format: "int64" },
            currency: { type: "string", example: "IDR" },
            transaction_date: { type: "string", format: "date", nullable: true },
            category: { type: "string", example: "other" },
            status: {
              type: "string",
              enum: ["processing", "needs_review", "confirmed", "rejected"],
            },
            created_at: { type: "string", format: "date-time" },
            confirmed_at: { type: "string", format: "date-time", nullable: true },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/ReceiptItem" },
            },
          },
        },
        ScanReceiptRequest: {
          type: "object",
          required: ["image_base64"],
          properties: {
            image_base64: {
              type: "string",
              description: "Base64-encoded receipt image (JPEG/PNG).",
              example: "aGVsbG8=",
            },
          },
        },
        ScanReceiptResponse: {
          type: "object",
          properties: {
            receipt_id: { type: "string", format: "uuid" },
            status: { type: "string", example: "processing" },
          },
        },
        UpdateReceiptRequest: {
          type: "object",
          properties: {
            merchant_name: { type: "string" },
            total_amount: { type: "integer", format: "int64" },
            transaction_date: { type: "string", format: "date" },
            category: { type: "string" },
            status: {
              type: "string",
              enum: ["processing", "needs_review", "confirmed", "rejected"],
            },
            currency: { type: "string" },
          },
        },
      },
    },
    security: [],
  },
  apis: ["./routes/*.js"],
};

const spec = swaggerJsdoc(options);

module.exports = spec;
