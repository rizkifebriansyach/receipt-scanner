const { MinioContainer } = require("@testcontainers/minio");
const { Client: MinioClient } = require("minio");

let minioContainer;
let adminClient;
let storage;

beforeAll(async () => {
  minioContainer = await new MinioContainer("minio/minio:latest").start();

  const host = minioContainer.getHost();
  const port = minioContainer.getMappedPort(9000);

  process.env.MINIO_ENDPOINT = `http://${host}:${port}`;
  process.env.MINIO_ACCESS_KEY = "minioadmin";
  process.env.MINIO_SECRET_KEY = "minioadmin";
  process.env.MINIO_BUCKET = "test-bucket";

  adminClient = new MinioClient({
    endPoint: host,
    port: port,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
  });
  await adminClient.makeBucket("test-bucket", "us-east-1");

  jest.resetModules();
  storage = require("../lib/storage");
});

afterAll(async () => {
  if (minioContainer) await minioContainer.stop();
});

describe("storage", () => {
  it("uploads and returns a signed url", async () => {
    const buffer = Buffer.from("fake-image-bytes");
    const key = "test/receipt-1.jpg";

    const path = await storage.putObject(key, buffer, "image/jpeg");
    expect(path).toBe(key);

    const url = await storage.getSignedUrl(key, 60);
    expect(url).toContain("test-bucket");
    expect(url).toContain("test/receipt-1.jpg");
    expect(url).toMatch(/^http/);
  });
});
