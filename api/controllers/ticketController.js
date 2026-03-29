const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

exports.addTicket = async (req, res) => {
  const db = await connectDB();
  const users = db.collection("users");
  const tickets = db.collection("tickets");

  const vendor = await users.findOne({
    email: req.body.vendorEmail,
  });

  if (vendor?.isFraud)
    return res
      .status(403)
      .json({ message: "Fraud vendors cannot add tickets" });

  const newTicket = {
    ...req.body,
    verificationStatus: "pending",
    isHidden: false,
    isAdvertised: false,
    createdAt: new Date(),
  };

  const result = await tickets.insertOne(newTicket);

  res.status(201).json({
    message: "Ticket added successfully",
    insertedId: result.insertedId,
  });
};

exports.getApprovedTickets = async (req, res) => {
  const db = await connectDB();
  const tickets = db.collection("tickets");

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

  const data = await tickets
    .find(query)
    .sort(sortQuery)
    .skip(Number(skip))
    .limit(Number(limit))
    .toArray();

  const total = await tickets.countDocuments(query);

  res.json({
    tickets: data,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

exports.getSingleTicket = async (req, res) => {
  const db = await connectDB();
  const ticket = await db
    .collection("tickets")
    .findOne({ _id: new ObjectId(req.params.id) });

  res.json(ticket);
};

exports.deleteTicket = async (req, res) => {
  const db = await connectDB();
  await db
    .collection("tickets")
    .deleteOne({ _id: new ObjectId(req.params.id) });

  res.json({ message: "Ticket deleted successfully" });
};

exports.updateTicket = async (req, res) => {
  const db = await connectDB();

  await db.collection("tickets").updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        ...req.body,
        verificationStatus: "pending",
        updatedAt: new Date(),
      },
    },
  );

  res.json({ message: "Ticket updated successfully" });
};
