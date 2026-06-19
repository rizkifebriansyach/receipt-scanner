function getDb() {
  return require("../../db/knex");
}

async function create({ user_id, source, image_path, telegram_message_id = null }) {
  const knex = getDb();
  const [row] = await knex("receipts")
    .insert({
      user_id,
      source,
      image_path,
      telegram_message_id,
    })
    .returning("*");
  return row;
}

async function findByIdForUser(id, userId) {
  const knex = getDb();
  const receipt = await knex("receipts").where({ id, user_id: userId }).first();
  if (!receipt) return null;
  const items = await knex("receipt_items")
    .where({ receipt_id: id })
    .orderBy("id", "asc");
  return { ...receipt, items };
}

async function update(id, userId, updates) {
  const knex = getDb();
  return knex
    .transaction(async (trx) => {
      const { items, ...rest } = updates;

      if (items !== undefined) {
        await trx("receipt_items").where({ receipt_id: id }).del();
        if (items.length > 0) {
          await trx("receipt_items").insert(
            items.map((item) => ({
              receipt_id: id,
              name: item.name,
              qty: item.qty,
              price: item.price,
            }))
          );
        }
      }

      const fieldsToUpdate = { ...rest };
      if (rest.status === "confirmed" && !rest.confirmed_at) {
        fieldsToUpdate.confirmed_at = knex.fn.now();
      }

      if (Object.keys(fieldsToUpdate).length === 0) {
        const current = await trx("receipts").where({ id, user_id: userId }).first();
        if (!current) throw new Error("RECEIPT_NOT_FOUND_OR_NOT_OWNER");
        return current;
      }

      const updatedRows = await trx("receipts")
        .where({ id, user_id: userId })
        .update(fieldsToUpdate)
        .returning("*");

      if (updatedRows.length === 0) {
        throw new Error("RECEIPT_NOT_FOUND_OR_NOT_OWNER");
      }
      return updatedRows[0];
    })
    .catch((err) => {
      if (err.message === "RECEIPT_NOT_FOUND_OR_NOT_OWNER") return null;
      throw err;
    });
}

async function listByUser(userId, { status, category, from, to, page = 1, limit = 20 }) {
  const knex = getDb();
  let query = knex("receipts").where({ user_id: userId });
  if (status) query = query.where({ status });
  if (category) query = query.where({ category });
  if (from) query = query.where("transaction_date", ">=", from);
  if (to) query = query.where("transaction_date", "<=", to);
  const offset = (page - 1) * limit;
  return query.orderBy("created_at", "desc").limit(limit).offset(offset);
}

async function findStuckProcessing() {
  const knex = getDb();
  return knex("receipts").where({ status: "processing" });
}

async function markStuckAsNeedsReview() {
  const knex = getDb();
  return knex("receipts")
    .where({ status: "processing" })
    .update({ status: "needs_review" });
}

module.exports = {
  create,
  findByIdForUser,
  update,
  listByUser,
  findStuckProcessing,
  markStuckAsNeedsReview,
};
