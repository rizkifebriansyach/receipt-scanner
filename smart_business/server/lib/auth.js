const admin = require("./firebase");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Missing bearer token" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ error: "unauthorized", message: "Invalid token" });
  }
}

module.exports = { requireAuth };
