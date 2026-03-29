const router = require("express").Router();
const verify = require("../middleware/verifyFirebaseToken");
const controller = require("../controllers/bookingController");

router.post("/", verify, controller.createBooking);

module.exports = router;
