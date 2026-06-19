const admin = require("firebase-admin");

function initFirebase() {
  if (admin.getApps().length > 0) return;

  const hasEnvConfig =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (hasEnvConfig) {
    admin.initializeApp({
      credential: admin.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    const serviceAccount = require("../serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.cert(serviceAccount),
    });
  }
}

initFirebase();

module.exports = admin;
