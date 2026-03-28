const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jehcuf6.mongodb.net/?appName=Cluster0`;

// Firebase Admin Setup
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Mongo Client (OPTIMIZED FOR VERCEL)
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("MongoDB connected");
  }
}

// Firebase Token Verify
const varifyFireBaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const fbToken = req.headers.authorization.split(" ")[1];

  try {
    const userInfo = await admin.auth().verifyIdToken(fbToken);
    req.token_email = userInfo.email;
    req.token_uid = userInfo.uid;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized" });
  }
};

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// DB Collections helper
const getCollections = () => {
  const db = client.db(process.env.DB_NAME);
  return {
    userCollection: db.collection("users"),
    ticketCollection: db.collection("tickets"),
    bookedTicketCollection: db.collection("bookedTickets"),
  };
};

// ================= ROUTES =================

// USERS
app.post("/users", async (req, res) => {
  try {
    const { userCollection } = getCollections();
    const userData = req.body;

    const exist = await userCollection.findOne({ email: userData.email });
    if (exist) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const result = await userCollection.insertOne({
      ...userData,
      role: "user",
    });

    res.status(201).json({
      message: "User created",
      insertedId: result.insertedId,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/users/:email", async (req, res) => {
  const { userCollection } = getCollections();
  const user = await userCollection.findOne({ email: req.params.email });
  res.json(user || null);
});

// TICKETS
app.post("/tickets", varifyFireBaseToken, async (req, res) => {
  const { userCollection, ticketCollection } = getCollections();

  const vendor = await userCollection.findOne({
    email: req.body.vendorEmail,
  });

  if (vendor?.isFraud) {
    return res.status(403).json({ message: "Fraud vendor" });
  }

  const result = await ticketCollection.insertOne({
    ...req.body,
    verificationStatus: "pending",
    isHidden: false,
    isAdvertised: false,
    createdAt: new Date(),
  });

  res.json(result);
});

app.get("/tickets", async (req, res) => {
  const { ticketCollection } = getCollections();

  const { from, to, transportType, sort, page = 1, limit = 6 } = req.query;

  const query = {
    verificationStatus: "approved",
    isHidden: false,
  };

  if (from) query.from = { $regex: from, $options: "i" };
  if (to) query.to = { $regex: to, $options: "i" };
  if (transportType) query.transportType = transportType;

  let sortQuery = {};
  if (sort === "price_low") sortQuery.price = 1;
  if (sort === "price_high") sortQuery.price = -1;

  const skip = (page - 1) * limit;

  const tickets = await ticketCollection
    .find(query)
    .sort(sortQuery)
    .skip(Number(skip))
    .limit(Number(limit))
    .toArray();

  const total = await ticketCollection.countDocuments(query);

  res.json({
    tickets,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// BOOKINGS
app.post("/bookings", varifyFireBaseToken, async (req, res) => {
  const { bookedTicketCollection } = getCollections();

  const result = await bookedTicketCollection.insertOne({
    ...req.body,
    status: "pending",
    bookedAt: new Date(),
  });

  res.json(result);
});

// STRIPE
app.post("/create-checkout-session", varifyFireBaseToken, async (req, res) => {
  const { bookingId, title, price, quantity, ticketId } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "bdt",
          product_data: { name: title },
          unit_amount: price * 100,
        },
        quantity,
      },
    ],
    success_url: `${process.env.CLIENT_URL}/payment-success`,
    cancel_url: `${process.env.CLIENT_URL}/cancel`,
  });

  res.json({ url: session.url });
});

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running...");
});

// EXPORT (IMPORTANT FOR VERCEL)
module.exports = app;
