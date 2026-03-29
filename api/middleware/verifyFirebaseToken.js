const admin = require("../config/firebase");

const verifyFirebaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = req.headers.authorization.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    req.token_email = decoded.email;
    req.token_uid = decoded.uid;

    next();
  } catch {
    res.status(401).send({ message: "Unauthorized" });
  }
};

module.exports = verifyFirebaseToken;
