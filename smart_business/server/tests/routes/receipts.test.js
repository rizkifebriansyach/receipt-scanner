const request = require("supertest");
const express = require("express");
const receiptsRepo = require("../../lib/repositories/receipts");
const usersRepo = require("../../lib/repositories/users");

const { mockFirebaseAdmin } = require("../helpers/firebaseMock");
const firebaseMock = mockFirebaseAdmin();

jest.mock("../../lib/storage", () => ({
  putObject: jest.fn().mockResolvedValue("mocked/path.jpg"),
  getSignedUrl: jest.fn().mockResolvedValue("http://mocked-url/test"),
}));

const receiptsRouter = require("../../routes/receipts");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/receipts", receiptsRouter);
  return app;
}

const TEST_UID = "test-uid-1";

async function seedReceipt(overrides = {}) {
  await usersRepo.upsertFromFirebase({
    firebase_uid: TEST_UID,
    email: "test@example.com",
  });
  const r = await receiptsRepo.create({
    user_id: TEST_UID,
    source: "flutter",
    image_path: `receipts/${TEST_UID}/${Math.random().toString(36).slice(2)}.jpg`,
    ...overrides,
  });
  return r;
}

describe("routes/receipts", () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  describe("GET /receipts", () => {
    it("returns 401 without auth", async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use("/receipts", receiptsRouter);
      const res = await request(noAuthApp).get("/receipts");
      expect(res.status).toBe(401);
    });

    it("returns list of user's receipts", async () => {
      await seedReceipt();
      await seedReceipt();

      const res = await request(app)
        .get("/receipts")
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it("filters by status", async () => {
      const r1 = await seedReceipt();
      await receiptsRepo.update(r1.id, TEST_UID, { status: "confirmed" });
      await seedReceipt();

      const res = await request(app)
        .get("/receipts?status=confirmed")
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe("confirmed");
    });
  });

  describe("GET /receipts/:id", () => {
    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .get("/receipts/00000000-0000-0000-0000-000000000000")
        .set("Authorization", "Bearer valid");
      expect(res.status).toBe(404);
    });

    it("returns 404 for other user's receipt", async () => {
      const r = await seedReceipt();
      firebaseMock.verifyIdToken.mockResolvedValueOnce({
        uid: "different-uid",
        email: "other@example.com",
      });

      const res = await request(app)
        .get(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(404);
    });

    it("returns receipt with items", async () => {
      const r = await seedReceipt();
      await receiptsRepo.update(r.id, TEST_UID, {
        merchant_name: "Alfamart",
        items: [{ name: "Aqua", qty: 1, price: 5000 }],
      });

      const res = await request(app)
        .get(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(r.id);
      expect(res.body.merchant_name).toBe("Alfamart");
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe("Aqua");
    });
  });

  describe("PATCH /receipts/:id", () => {
    it("updates receipt fields", async () => {
      const r = await seedReceipt();

      const res = await request(app)
        .patch(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid")
        .send({ merchant_name: "Indomaret", total_amount: 15000 });

      expect(res.status).toBe(200);
      expect(res.body.merchant_name).toBe("Indomaret");
      expect(res.body.total_amount).toBe(15000);
    });

    it("confirms receipt and sets confirmed_at", async () => {
      const r = await seedReceipt();
      await receiptsRepo.update(r.id, TEST_UID, { status: "needs_review" });

      const res = await request(app)
        .patch(`/receipts/${r.id}`)
        .set("Authorization", "Bearer valid")
        .send({ status: "confirmed" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("confirmed");
      expect(res.body.confirmed_at).toBeTruthy();
    });

    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .patch("/receipts/00000000-0000-0000-0000-000000000000")
        .set("Authorization", "Bearer valid")
        .send({ merchant_name: "X" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /receipts/:id/image", () => {
    it("redirects to signed url", async () => {
      const r = await seedReceipt();

      const res = await request(app)
        .get(`/receipts/${r.id}/image`)
        .set("Authorization", "Bearer valid");

      expect(res.status).toBe(302);
      expect(res.headers.location).toBeTruthy();
    });

    it("returns 404 for non-existent", async () => {
      const res = await request(app)
        .get("/receipts/00000000-0000-0000-0000-000000000000/image")
        .set("Authorization", "Bearer valid");
      expect(res.status).toBe(404);
    });
  });
});
