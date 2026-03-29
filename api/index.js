const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const homepageRoutes = require("./routes/homepageRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/users", userRoutes);
app.use("/tickets", ticketRoutes);
app.use("/bookings", bookingRoutes);
app.use("/", paymentRoutes);
app.use("/admin", adminRoutes);
app.use("/homepage", homepageRoutes);

connectDB();

module.exports = app;
