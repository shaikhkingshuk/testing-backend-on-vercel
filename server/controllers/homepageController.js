const connectDB = require("../config/db");

/*
-----------------------------------
GET HOMEPAGE ADS
-----------------------------------
*/
exports.getHomepageAds = async (req, res) => {
  try {
    const db = await connectDB();

    const tickets = await db
      .collection("tickets")
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
};

/*
-----------------------------------
LATEST APPROVED TICKETS
-----------------------------------
*/
exports.getLatestTickets = async (req, res) => {
  try {
    const db = await connectDB();

    const tickets = await db
      .collection("tickets")
      .find({
        verificationStatus: "approved",
        isHidden: false,
      })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
