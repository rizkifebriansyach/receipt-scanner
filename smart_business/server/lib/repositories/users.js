function getDb() {
  return require("../../db/knex");
}

async function upsertFromFirebase({ firebase_uid, email, display_name }) {
  const knex = getDb();
  const [row] = await knex("users")
    .insert({
      firebase_uid,
      email,
      display_name: display_name || null,
    })
    .onConflict("firebase_uid")
    .merge({
      email,
      ...(display_name ? { display_name } : {}),
    })
    .returning("*");
  return row;
}

async function findByTelegramChatId(chatId) {
  const knex = getDb();
  const row = await knex("users").where({ telegram_chat_id: chatId }).first();
  return row || null;
}

async function findByLinkCode(code) {
  const knex = getDb();
  const row = await knex("users")
    .where({ link_code: code })
    .where("link_code_expires_at", ">", knex.fn.now())
    .first();
  return row || null;
}

async function linkTelegram(firebaseUid, chatId) {
  const knex = getDb();
  await knex("users").where({ firebase_uid: firebaseUid }).update({
    telegram_chat_id: chatId,
    link_code: null,
    link_code_expires_at: null,
  });
}

module.exports = {
  upsertFromFirebase,
  findByTelegramChatId,
  findByLinkCode,
  linkTelegram,
};
