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

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateLinkCode(firebaseUid) {
  const knex = getDb();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await knex("users").where({ firebase_uid: firebaseUid }).update({
    link_code: code,
    link_code_expires_at: expiresAt,
  });
  return { link_code: code, expires_at: expiresAt };
}

async function getLinkStatus(firebaseUid) {
  const knex = getDb();
  const row = await knex("users")
    .select("telegram_chat_id", "link_code", "link_code_expires_at")
    .where({ firebase_uid: firebaseUid })
    .first();
  if (!row) return { linked: false, has_pending_code: false };
  return {
    linked: !!row.telegram_chat_id,
    has_pending_code: !!(row.link_code && new Date(row.link_code_expires_at) > new Date()),
  };
}

module.exports = {
  upsertFromFirebase,
  findByTelegramChatId,
  findByLinkCode,
  linkTelegram,
  generateLinkCode,
  getLinkStatus,
};
