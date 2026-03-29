const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

/*
-----------------------------------
GET ALL TICKETS (ADMIN)
-----------------------------------
*/
exports.getAllTicketsAdmin = async (req, res) => {
  try {
    const db = await connectDB();

    const tickets = await db
      .collection("tickets")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/*
-----------------------------------
APPROVE / REJECT TICKET
-----------------------------------
*/
exports.updateTicketStatus = async (req, res) => {
  try {
    const db = await connectDB();

    const { status } = req.body; // approved | rejected
    const id = req.params.id;

    const result = await db.collection("tickets").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          verificationStatus: status,
          updatedAt: new Date(),
        },
      },
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/*
-----------------------------------
CHANGE USER ROLE
-----------------------------------
*/
exports.updateUserRole = async (req, res) => {
  try {
    const db = await connectDB();

    const { role } = req.body;
    const id = req.params.id;

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role,
          isFraud: false,
        },
      },
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/*
-----------------------------------
MARK VENDOR AS FRAUD
-----------------------------------
*/
exports.markVendorFraud = async (req, res) => {
  try {
    const db = await connectDB();
    const id = req.params.id;

    const users = db.collection("users");
    const tickets = db.collection("tickets");

    const user = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!user || user.role !== "vendor") {
      return res
        .status(400)
        .json({ message: "Only vendors can be marked fraud" });
    }

    // mark fraud
    await users.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          role: "fraud",
          isFraud: true,
        },
      },
    );

    // hide vendor tickets
    await tickets.updateMany(
      { vendorEmail: user.email },
      { $set: { isHidden: true } },
    );

    res.json({
      message: "Vendor marked as fraud & tickets hidden",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/*
-----------------------------------
ADVERTISE TICKET
-----------------------------------
*/
exports.advertiseTicket = async (req, res) => {
  try {
    const db = await connectDB();
    const tickets = db.collection("tickets");

    const id = req.params.id;
    const { isAdvertised } = req.body;

    const ticket = await tickets.findOne({
      _id: new ObjectId(id),
    });

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (isAdvertised && ticket.verificationStatus !== "approved") {
      return res
        .status(400)
        .json({ message: "Only approved tickets can be advertised" });
    }

    if (isAdvertised) {
      const count = await tickets.countDocuments({
        isAdvertised: true,
      });

      if (count >= 6) {
        return res
          .status(400)
          .json({ message: "Maximum 6 tickets can be advertised" });
      }
    }

    await tickets.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAdvertised } },
    );

    res.json({ message: "Advertisement status updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
