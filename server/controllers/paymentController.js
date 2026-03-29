const connectDB = require("../config/db");
const stripe = require("../config/stripe");
const { ObjectId } = require("mongodb");

exports.createCheckoutSession = async (req, res) => {
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
    success_url: `${process.env.CLIENT_URL}/payment-success?bookingId=${bookingId}&ticketId=${ticketId}&quantity=${quantity}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/dashboard/user/paymentCancel`,
  });

  res.json({ url: session.url });
};

exports.markBookingPaid = async (req, res) => {
  const db = await connectDB();

  const { ticketId, bookedQuantity, transactionId } = req.body;

  await db.collection("bookedTickets").updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        status: "paid",
        paidAt: new Date(),
        transactionId,
      },
    },
  );

  await db
    .collection("tickets")
    .updateOne(
      { _id: new ObjectId(ticketId) },
      { $inc: { quantity: -bookedQuantity } },
    );

  res.json({ message: "Payment successful" });
};
