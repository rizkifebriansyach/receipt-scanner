exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable("users", (table) => {
    table.string("firebase_uid", 128).primary();
    table.string("email", 255).notNullable().unique();
    table.string("display_name", 255);
    table.bigInteger("telegram_chat_id").unique();
    table.specificType("link_code", "char(6)");
    table.timestamptz("link_code_expires_at");
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    "CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL"
  );
  await knex.raw(
    "CREATE INDEX idx_users_link_code ON users(link_code) WHERE link_code IS NOT NULL"
  );

  await knex.schema.createTable("receipts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .string("user_id", 128)
      .notNullable()
      .references("firebase_uid")
      .inTable("users")
      .onDelete("CASCADE");
    table.specificType("source", "varchar(32)").notNullable();
    table.bigInteger("telegram_message_id");
    table.string("image_path", 512).notNullable();
    table.text("ocr_raw_text").notNullable().defaultTo("");
    table.string("merchant_name", 255).notNullable().defaultTo("");
    table.bigInteger("total_amount").notNullable().defaultTo(0);
    table.specificType("currency", "char(3)").notNullable().defaultTo("IDR");
    table.date("transaction_date");
    table.string("category", 64).notNullable().defaultTo("other");
    table.specificType("status", "varchar(32)").notNullable().defaultTo("processing");
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamptz("confirmed_at");
  });

  await knex.raw(
    "ALTER TABLE receipts ADD CONSTRAINT receipts_source_check CHECK (source IN ('telegram', 'flutter'))"
  );
  await knex.raw(
    "ALTER TABLE receipts ADD CONSTRAINT receipts_status_check CHECK (status IN ('processing', 'needs_review', 'confirmed', 'rejected'))"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_created ON receipts(user_id, created_at DESC)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_status ON receipts(user_id, status)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_user_cat_date ON receipts(user_id, category, transaction_date)"
  );
  await knex.raw(
    "CREATE INDEX idx_receipts_processing ON receipts(created_at) WHERE status = 'processing'"
  );

  await knex.schema.createTable("receipt_items", (table) => {
    table.bigIncrements("id").primary();
    table
      .uuid("receipt_id")
      .notNullable()
      .references("id")
      .inTable("receipts")
      .onDelete("CASCADE");
    table.string("name", 255).notNullable();
    table.integer("qty").notNullable().defaultTo(1);
    table.bigInteger("price").notNullable().defaultTo(0);
    table.timestamptz("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("ALTER TABLE receipt_items ADD CONSTRAINT receipt_items_qty_check CHECK (qty > 0)");
  await knex.raw("CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id)");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("receipt_items");
  await knex.schema.dropTableIfExists("receipts");
  await knex.schema.dropTableIfExists("users");
};
