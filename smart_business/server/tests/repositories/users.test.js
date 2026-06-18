const users = require("../../lib/repositories/users");

const TEST_USER = {
  firebase_uid: "firebase-uid-1",
  email: "user1@example.com",
  display_name: "User One",
};

describe("users repository", () => {
  describe("upsertFromFirebase", () => {
    it("creates user when not exists", async () => {
      const result = await users.upsertFromFirebase(TEST_USER);

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.email).toBe("user1@example.com");
      expect(result.display_name).toBe("User One");
      expect(result.created_at).toBeTruthy();
    });

    it("updates email when user already exists", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const result = await users.upsertFromFirebase({
        firebase_uid: "firebase-uid-1",
        email: "new-email@example.com",
      });

      expect(result.email).toBe("new-email@example.com");
    });
  });

  describe("findByTelegramChatId", () => {
    it("returns null when no user matches", async () => {
      const result = await users.findByTelegramChatId(12345);
      expect(result).toBeNull();
    });

    it("returns user when match found", async () => {
      await users.upsertFromFirebase(TEST_USER);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ telegram_chat_id: 12345 });

      const result = await users.findByTelegramChatId(12345);

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.telegram_chat_id).toBe(12345);
    });
  });

  describe("findByLinkCode", () => {
    it("returns null when code does not exist", async () => {
      const result = await users.findByLinkCode("ABC123");
      expect(result).toBeNull();
    });

    it("returns user when code matches and not expired", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const future = new Date(Date.now() + 5 * 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "ABC123", link_code_expires_at: future });

      const result = await users.findByLinkCode("ABC123");

      expect(result.firebase_uid).toBe("firebase-uid-1");
      expect(result.link_code).toBe("ABC123");
    });

    it("returns null when code matches but expired", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const past = new Date(Date.now() - 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "OLD123", link_code_expires_at: past });

      const result = await users.findByLinkCode("OLD123");
      expect(result).toBeNull();
    });
  });

  describe("linkTelegram", () => {
    it("sets telegram_chat_id and clears link_code", async () => {
      await users.upsertFromFirebase(TEST_USER);
      const future = new Date(Date.now() + 5 * 60 * 1000);
      await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .update({ link_code: "ABC123", link_code_expires_at: future });

      await users.linkTelegram("firebase-uid-1", 99999);

      const user = await global.knex("users")
        .where({ firebase_uid: "firebase-uid-1" })
        .first();
      expect(user.telegram_chat_id).toBe(99999);
      expect(user.link_code).toBeNull();
      expect(user.link_code_expires_at).toBeNull();
    });
  });
});
