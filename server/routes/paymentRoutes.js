const router = require("express").Router();
const verify = require("../middleware/verifyFirebaseToken");
const controller = require("../controllers/paymentController");

router.post(
  "/create-checkout-session",
  verify,
  controller.createCheckoutSession,
);
router.patch("/bookings/pay/:id", verify, controller.markBookingPaid);

module.exports = router;
