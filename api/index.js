const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 3000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jehcuf6.mongodb.net/?appName=Cluster0`;

const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);

// Fix private key formatting (important for deployment)
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const varifyFireBaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const fbToken = req.headers.authorization.split(" ")[1];

  if (!fbToken) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(fbToken);

    req.token_email = userInfo.email;
    req.token_uid = userInfo.uid;

    next();
  } catch (errror) {
    return res.status(401).send({ message: "Unauthorized" });
  }
};

async function run() {
  try {
    let isConnected = false;
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const db = client.db(process.env.DB_NAME);
    const userCollection = db.collection("users");
    const ticketCollection = db.collection("tickets");
    const bookedTicketCollection = db.collection("bookedTickets");
    const homepageAdsCollection = db.collection("homepageAds");

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    app.post("/users", async (req, res) => {
      try {
        const userData = req.body;

        const userExist = await userCollection.findOne({
          email: userData.email,
        });

        if (userExist) {
          return res.status(409).json({
            message: "Email already exists",
          });
        }

        const result = await userCollection.insertOne({
          ...userData,
          role: "user",
        });

        res.status(201).json({
          message: "User created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.json(null);
        }

        res.json(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // adding tickets

    app.post("/tickets", varifyFireBaseToken, async (req, res) => {
      try {
        const vendor = await userCollection.findOne({
          email: req.body.vendorEmail,
        });

        if (vendor?.isFraud) {
          return res.status(403).json({
            message: "Fraud vendors cannot add tickets",
          });
        }
        const ticket = req.body;

        const newTicket = {
          title: ticket.title,
          from: ticket.from,
          to: ticket.to,
          transportType: ticket.transportType,
          price: ticket.price,
          quantity: ticket.quantity,
          departureDateTime: ticket.departureDateTime,
          perks: ticket.perks,
          image: ticket.image,
          vendorName: ticket.vendorName,
          vendorEmail: ticket.vendorEmail,
          verificationStatus: "pending",
          isHidden: false,
          isAdvertised: false,
          createdAt: new Date(),
        };

        const result = await ticketCollection.insertOne(newTicket);

        res.status(201).json({
          message: "Ticket added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // getting my added tickets

    app.get("/tickets/vendor/:email", varifyFireBaseToken, async (req, res) => {
      try {
        const email = req.params.email;

        const tickets = await ticketCollection
          .find({ vendorEmail: email })
          .toArray();

        res.json(tickets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    const { ObjectId } = require("mongodb");

    // deleting tickets

    app.delete("/tickets/:id", varifyFireBaseToken, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await ticketCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        res.json({ message: "Ticket deleted successfully" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // UPDATE ticket
    app.patch("/tickets/:id", varifyFireBaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const result = await ticketCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...updatedData,
              verificationStatus: "pending", // reset after update
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        res.json({ message: "Ticket updated successfully" });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET all approved tickets
    // GET all approved tickets with search, filter, sort & pagination
    app.get("/tickets", async (req, res) => {
      try {
        const {
          from,
          to,
          transportType,
          sort,
          page = 1,
          limit = 6,
        } = req.query;

        const query = {
          verificationStatus: "approved",
          isHidden: false,
        };

        // SEARCH
        if (from) query.from = { $regex: from, $options: "i" };
        if (to) query.to = { $regex: to, $options: "i" };

        // FILTER
        if (transportType) query.transportType = transportType;

        // SORT
        let sortQuery = {};
        if (sort === "price_low") sortQuery.price = 1;
        if (sort === "price_high") sortQuery.price = -1;

        const skip = (Number(page) - 1) * Number(limit);

        const tickets = await ticketCollection
          .find(query)
          .sort(sortQuery)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        const total = await ticketCollection.countDocuments(query);

        res.json({
          tickets,
          total,
          totalPages: Math.ceil(total / limit),
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // getting single ticket details
    app.get("/tickets/:id", varifyFireBaseToken, async (req, res) => {
      try {
        const ticket = await ticketCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!ticket) {
          return res.status(404).json({ message: "Ticket not found" });
        }

        res.json(ticket);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/bookings", varifyFireBaseToken, async (req, res) => {
      try {
        const booking = req.body;

        const result = await bookedTicketCollection.insertOne({
          ...booking,
          status: "pending",
          bookedAt: new Date(),
        });

        res.status(201).json({
          message: "Booking successful",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    //vendor getting all booked tickets list

    app.get("/vendor/bookings", varifyFireBaseToken, async (req, res) => {
      try {
        const vendorEmail = req.query.email;

        if (!vendorEmail) {
          return res.status(400).json({ message: "Vendor email required" });
        }

        // Get vendor tickets first
        const vendorTickets = await ticketCollection
          .find({ vendorEmail })
          .project({ _id: 1 })
          .toArray();

        const ticketIds = vendorTickets.map((t) => t._id.toString());

        // Find bookings for those tickets
        const bookings = await bookedTicketCollection
          .find({ ticketId: { $in: ticketIds } })
          .sort({ bookedAt: -1 })
          .toArray();

        res.json(bookings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /// for accepting tickets

    app.patch("/bookings/accept/:id", varifyFireBaseToken, async (req, res) => {
      const id = req.params.id;

      const result = await bookedTicketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "accepted" } },
      );

      if (!result.matchedCount) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json({ message: "Booking accepted" });
    });

    /// for rejecting tickets

    app.patch("/bookings/reject/:id", varifyFireBaseToken, async (req, res) => {
      const id = req.params.id;

      const result = await bookedTicketCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected" } },
      );

      if (!result.matchedCount) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json({ message: "Booking rejected" });
    });

    // GET My Booked Tickets (User)
    app.get(
      "/bookedTickets/user/:email",
      varifyFireBaseToken,
      async (req, res) => {
        const email = req.params.email;

        const bookings = await bookedTicketCollection
          .find({ userEmail: email })
          .sort({ bookedAt: -1 })
          .toArray();

        const ticketIds = bookings.map((b) => new ObjectId(b.ticketId));

        const tickets = await ticketCollection
          .find({ _id: { $in: ticketIds } })
          .toArray();

        const ticketMap = {};
        tickets.forEach((t) => {
          ticketMap[t._id.toString()] = t;
        });

        const finalData = bookings.map((b) => ({
          ...b,
          ticket: ticketMap[b.ticketId],
        }));

        res.json(finalData);
      },
    );

    app.post(
      "/create-checkout-session",
      varifyFireBaseToken,
      async (req, res) => {
        const { bookingId, title, price, quantity, ticketId } = req.body;

        try {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"], // Visa, Mastercard, etc.
            mode: "payment",
            line_items: [
              {
                price_data: {
                  currency: "bdt",
                  product_data: {
                    name: title,
                  },
                  unit_amount: price * 100, // cents
                },
                quantity,
              },
            ],
            success_url: `${process.env.CLIENT_URL}/payment-success?bookingId=${bookingId}&ticketId=${ticketId}&quantity=${quantity}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/dashboard/user/paymentCancel`,
          });

          res.json({ url: session.url });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      },
    );

    app.patch("/bookings/pay/:id", varifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const { ticketId, bookedQuantity, transactionId } = req.body;

      await bookedTicketCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "paid",
            paidAt: new Date(),
            transactionId, // ✅ store Stripe transaction ID
          },
        },
      );

      await ticketCollection.updateOne(
        { _id: new ObjectId(ticketId) },
        { $inc: { quantity: -bookedQuantity } },
      );

      res.json({ message: "Payment successful" });
    });

    app.get(
      "/transactions/user/:email",
      varifyFireBaseToken,
      async (req, res) => {
        const email = req.params.email;

        const transactions = await bookedTicketCollection
          .find({
            userEmail: email,
            status: "paid",
          })
          .sort({ paidAt: -1 })
          .toArray();

        res.json(transactions);
      },
    );

    // Revenue Overview (Vendor)
    app.get(
      "/vendor/revenue-overview",
      varifyFireBaseToken,
      async (req, res) => {
        try {
          const vendorEmail = req.query.email;
          if (!vendorEmail) {
            return res.status(400).json({ message: "Vendor email required" });
          }

          // Vendor tickets
          const tickets = await ticketCollection
            .find({ vendorEmail })
            .toArray();

          const ticketIds = tickets.map((t) => t._id.toString());

          // Paid bookings
          const paidBookings = await bookedTicketCollection
            .find({
              ticketId: { $in: ticketIds },
              status: "paid",
            })
            .toArray();

          const totalRevenue = paidBookings.reduce(
            (sum, b) => sum + (b.price || 0) * (b.bookedQuantity || 0),
            0,
          );

          const totalTicketsSold = paidBookings.reduce(
            (sum, b) => sum + (b.bookedQuantity || 0),
            0,
          );

          // ✅ FIX: total seats added, not number of tickets
          const totalTicketsAdded = tickets.reduce(
            (sum, t) => sum + (t.quantity || 0),
            0,
          );

          const revenueByDate = {};
          paidBookings.forEach((b) => {
            if (!b.paidAt) return;
            const date = new Date(b.paidAt).toLocaleDateString();
            revenueByDate[date] =
              (revenueByDate[date] || 0) +
              (b.price || 0) * (b.bookedQuantity || 0);
          });

          res.json({
            totalRevenue,
            totalTicketsSold,
            totalTicketsAdded,
            revenueChart: revenueByDate,
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      },
    );

    // // GET all tickets (admin)

    // GET all tickets (ADMIN)
    app.get("/admin/tickets", varifyFireBaseToken, async (req, res) => {
      const tickets = await ticketCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.json(tickets);
    });

    // Approve or Reject ticket (ADMIN)
    app.patch("/admin/tickets/:id", varifyFireBaseToken, async (req, res) => {
      const { status } = req.body; // approved | rejected
      const id = req.params.id;

      const result = await ticketCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            verificationStatus: status,
            updatedAt: new Date(),
          },
        },
      );

      res.json(result);
    });

    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.json(users);
    });

    app.patch("/users/role/:id", varifyFireBaseToken, async (req, res) => {
      const { role } = req.body;
      const id = req.params.id;

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            role,
            isFraud: false,
          },
        },
      );

      res.json(result);
    });

    app.patch("/users/fraud/:id", varifyFireBaseToken, async (req, res) => {
      const id = req.params.id;
      const user = await userCollection.findOne({ _id: new ObjectId(id) });

      if (!user || user.role !== "vendor") {
        return res
          .status(400)
          .json({ message: "Only vendors can be marked fraud" });
      }

      // 1. Mark user as fraud
      await userCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            role: "fraud",
            isFraud: true,
          },
        },
      );

      // 2. Hide all vendor tickets
      await ticketCollection.updateMany(
        { vendorEmail: user.email },
        {
          $set: { isHidden: true },
        },
      );

      res.json({ message: "Vendor marked as fraud & tickets hidden" });
    });

    app.get("/homepage/ads", async (req, res) => {
      try {
        const tickets = await ticketCollection
          .find({
            isAdvertised: true,
            verificationStatus: "approved",
            isHidden: false,
          })
          .limit(6)
          .toArray();

        res.json(tickets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch(
      "/admin/tickets/advertise/:id",
      varifyFireBaseToken,
      async (req, res) => {
        try {
          const id = req.params.id;
          const { isAdvertised } = req.body;

          const ticket = await ticketCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
          }

          if (isAdvertised && ticket.verificationStatus !== "approved") {
            return res
              .status(400)
              .json({ message: "Only approved tickets can be advertised" });
          }

          if (isAdvertised) {
            const count = await ticketCollection.countDocuments({
              isAdvertised: true,
            });

            if (count >= 6) {
              return res
                .status(400)
                .json({ message: "Maximum 6 tickets can be advertised" });
            }
          }

          await ticketCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { isAdvertised } },
          );

          res.json({ message: "Advertisement status updated" });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      },
    );

    app.get("/homepage/latest-tickets", async (req, res) => {
      try {
        const tickets = await ticketCollection
          .find({ verificationStatus: "approved", isHidden: false })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();

        res.json(tickets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

module.exports = app;
