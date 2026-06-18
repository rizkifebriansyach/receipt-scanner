module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEach: ["<rootDir>/tests/setup.js"],
  testTimeout: 60000,
  clearMocks: true,
};
