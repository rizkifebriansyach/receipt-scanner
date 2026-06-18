const { PostgreSqlContainer } = require("@testcontainers/postgresql");

let pgContainer;
let knexInstance;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = pgContainer.getConnectionUri();

  knexInstance = require("../db/knex");
  await knexInstance.migrate.latest();

  global.knex = knexInstance;
  global.pgContainer = pgContainer;
});

afterAll(async () => {
  if (knexInstance) await knexInstance.destroy();
  if (pgContainer) await pgContainer.stop();
});

beforeEach(async () => {
  if (knexInstance) {
    await knexInstance.raw(
      "TRUNCATE users, receipts, receipt_items RESTART IDENTITY CASCADE"
    );
  }
});
