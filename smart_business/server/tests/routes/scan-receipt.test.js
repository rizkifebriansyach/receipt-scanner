const request = require("supertest");

const { mockFirebaseAdmin } = require("../helpers/firebaseMock");
const firebaseMock = mockFirebaseAdmin();

jest.mock("../../lib/storage", () => ({
  putObject: jest.fn().mockResolvedValue("mocked/path.jpg"),
  getSignedUrl: jest.fn().mockResolvedValue("http://mocked-url/test"),
}));

jest.mock("../../lib/ocr", () => ({
  extractText: jest.fn().mockResolvedValue(""),
}));

jest.mock("../../lib/parser", () => ({
  parseReceiptText: jest.fn().mockReturnValue({
    merchantName: "",
    totalAmount: 0,
    transactionDate: null,
    items: [],
  }),
}));

jest.mock("../../lib/categorizer", () => ({
  categorize: jest.fn().mockReturnValue("other"),
}));

describe("POST /scan-receipt", () => {
  let app;

  beforeAll(() => {
    app = require("../../index");
  });

  afterAll(async () => {
    const knex = require("../../db/knex");
    await knex.destroy();
  });

  it("returns 401 when no bearer token", async () => {
    const res = await request(app).post("/scan-receipt").send({ image_base64: "abc" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 401 when token verification fails", async () => {
    firebaseMock.verifyIdToken.mockRejectedValueOnce(new Error("bad token"));

    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer fake-token")
      .send({ image_base64: "abc" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 400 when image_base64 missing", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("returns 200 with receipt_id when valid", async () => {
    const res = await request(app)
      .post("/scan-receipt")
      .set("Authorization", "Bearer valid-token")
      .send({ image_base64: "aGVsbG8=" });

    expect(res.status).toBe(200);
    expect(res.body.receipt_id).toBeTruthy();
    expect(res.body.status).toBe("processing");
  });
});
