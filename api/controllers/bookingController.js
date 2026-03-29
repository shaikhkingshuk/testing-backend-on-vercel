const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

exports.createBooking = async (req, res) => {
  const db = await connectDB();

  const result = await db.collection("bookedTickets").insertOne({
    ...req.body,
    status: "pending",
    bookedAt: new Date(),
  });

  res.status(201).json({
    message: "Booking successful",
    insertedId: result.insertedId,
  });
};
