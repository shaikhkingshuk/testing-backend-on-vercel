const connectDB = require("../config/db");

// Create new user
exports.createUser = async (req, res) => {
  const db = await connectDB();
  const users = db.collection("users");

  const exists = await users.findOne({ email: req.body.email });
  if (exists) return res.status(409).json({ message: "Email already exists" });

  const result = await users.insertOne({
    ...req.body,
    role: "user",
  });

  res.status(201).json({
    message: "User created successfully",
    insertedId: result.insertedId,
  });
};

// Get single user by email
exports.getUserByEmail = async (req, res) => {
  const db = await connectDB();
  const users = db.collection("users");

  const user = await users.findOne({ email: req.params.email });
  res.json(user || null);
};

// Get all users
exports.getAllUsers = async (req, res) => {
  const db = await connectDB();
  const users = await db.collection("users").find().toArray();
  res.json(users);
};

// NEW: Update user profile (name & photoURL)
exports.updateUserProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const { name, photoURL } = req.body;

    // Only allow the authenticated user to update their own profile
    if (req.token_email !== email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const db = await connectDB();
    const users = db.collection("users");

    const result = await users.updateOne(
      { email },
      { $set: { name, photoURL, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await users.findOne({ email });
    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
