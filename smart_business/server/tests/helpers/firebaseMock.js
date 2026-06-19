function mockFirebaseAdmin({ uid = "test-uid-1", email = "test@example.com" } = {}) {
  const verifyIdToken = jest.fn().mockResolvedValue({ uid, email });
  jest.doMock("../../lib/firebase", () => ({
    auth: () => ({ verifyIdToken }),
    getApps: () => [],
    initializeApp: jest.fn(),
    cert: jest.fn(),
  }));
  return { verifyIdToken, uid, email };
}

module.exports = { mockFirebaseAdmin };
