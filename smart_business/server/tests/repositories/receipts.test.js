const receipts = require("../../lib/repositories/receipts");
const usersRepo = require("../../lib/repositories/users");

const USER_A = { firebase_uid: "uid-a", email: "a@example.com", display_name: "A" };
const USER_B = { firebase_uid: "uid-b", email: "b@example.com", display_name: "B" };

async function seedUsers() {
  await usersRepo.upsertFromFirebase(USER_A);
  await usersRepo.upsertFromFirebase(USER_B);
}

describe("receipts repository", () => {
  beforeEach(async () => {
    await seedUsers();
  });

  describe("create", () => {
    it("inserts receipt and returns the new row", async () => {
      const receipt = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "receipts/uid-a/test.jpg",
      });

      expect(receipt.id).toBeTruthy();
      expect(receipt.user_id).toBe("uid-a");
      expect(receipt.source).toBe("flutter");
      expect(receipt.status).toBe("processing");
      expect(receipt.image_path).toBe("receipts/uid-a/test.jpg");
    });

    it("rejects invalid source", async () => {
      await expect(
        receipts.create({
          user_id: "uid-a",
          source: "fax",
          image_path: "x.jpg",
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates receipt fields and items atomically", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "receipts/uid-a/test.jpg",
      });

      const updated = await receipts.update(created.id, "uid-a", {
        merchant_name: "Indomaret",
        total_amount: 25000,
        status: "needs_review",
        items: [
          { name: "Aqua", qty: 2, price: 5000 },
          { name: "Roti", qty: 1, price: 15000 },
        ],
      });

      expect(updated.merchant_name).toBe("Indomaret");
      expect(updated.total_amount).toBe(25000);
      expect(updated.status).toBe("needs_review");

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.items).toHaveLength(2);
      expect(fetched.items[0].name).toBe("Aqua");
      expect(fetched.items[1].name).toBe("Roti");
    });

    it("replaces existing items on update", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "Item1", qty: 1, price: 1000 }],
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "Item2", qty: 1, price: 2000 }],
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.items).toHaveLength(1);
      expect(fetched.items[0].name).toBe("Item2");
    });

    it("returns null when receipt does not belong to user", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });

      const result = await receipts.update(created.id, "uid-b", {
        merchant_name: "Hacked",
      });

      expect(result).toBeNull();

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.merchant_name).toBe("");
    });
  });

  describe("findByIdForUser", () => {
    it("returns receipt with items for owner", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });
      await receipts.update(created.id, "uid-a", {
        items: [{ name: "X", qty: 1, price: 100 }],
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-a");
      expect(fetched.id).toBe(created.id);
      expect(fetched.items).toHaveLength(1);
    });

    it("returns null for non-owner", async () => {
      const created = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "x.jpg",
      });

      const fetched = await receipts.findByIdForUser(created.id, "uid-b");
      expect(fetched).toBeNull();
    });
  });

  describe("listByUser", () => {
    it("returns only the user's receipts, newest first", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await new Promise((r) => setTimeout(r, 50));
      const r2 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });
      await receipts.create({
        user_id: "uid-b",
        source: "flutter",
        image_path: "b1.jpg",
      });

      const list = await receipts.listByUser("uid-a", {});

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(r2.id);
      expect(list[1].id).toBe(r1.id);
    });

    it("filters by status", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await receipts.update(r1.id, "uid-a", { status: "confirmed" });
      await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });

      const list = await receipts.listByUser("uid-a", { status: "confirmed" });

      expect(list).toHaveLength(1);
      expect(list[0].status).toBe("confirmed");
    });

    it("paginates with limit and page", async () => {
      for (let i = 0; i < 5; i++) {
        await receipts.create({
          user_id: "uid-a",
          source: "flutter",
          image_path: `a${i}.jpg`,
        });
        await new Promise((r) => setTimeout(r, 20));
      }

      const page1 = await receipts.listByUser("uid-a", { page: 1, limit: 2 });
      const page2 = await receipts.listByUser("uid-a", { page: 2, limit: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("findStuckProcessing", () => {
    it("returns only processing receipts", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      await receipts.update(r1.id, "uid-a", { status: "confirmed" });
      const r2 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a2.jpg",
      });

      const stuck = await receipts.findStuckProcessing();

      expect(stuck).toHaveLength(1);
      expect(stuck[0].id).toBe(r2.id);
    });
  });

  describe("markStuckAsNeedsReview", () => {
    it("updates all stuck receipts to needs_review", async () => {
      const r1 = await receipts.create({
        user_id: "uid-a",
        source: "flutter",
        image_path: "a1.jpg",
      });
      const r2 = await receipts.create({
        user_id: "uid-b",
        source: "flutter",
        image_path: "b1.jpg",
      });

      const count = await receipts.markStuckAsNeedsReview();

      expect(count).toBe(2);
      const check1 = await receipts.findByIdForUser(r1.id, "uid-a");
      const check2 = await receipts.findByIdForUser(r2.id, "uid-b");
      expect(check1.status).toBe("needs_review");
      expect(check2.status).toBe("needs_review");
    });
  });
});
