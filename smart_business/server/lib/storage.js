const { Client: MinioClient } = require("minio");

let clientInstance = null;

function getClient() {
  if (clientInstance) return clientInstance;

  const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";
  const url = new URL(endpoint);

  clientInstance = new MinioClient({
    endPoint: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    useSSL: url.protocol === "https:",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
  return clientInstance;
}

async function putObject(key, buffer, contentType) {
  const bucket = process.env.MINIO_BUCKET;
  const client = getClient();
  await client.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return key;
}

async function getSignedUrl(key, expiresInSeconds = 60) {
  const bucket = process.env.MINIO_BUCKET;
  const client = getClient();
  return client.presignedGetObject(bucket, key, expiresInSeconds);
}

module.exports = { putObject, getSignedUrl, getClient };
