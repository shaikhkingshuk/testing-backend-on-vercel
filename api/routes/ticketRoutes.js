const router = require("express").Router();
const verify = require("../middleware/verifyFirebaseToken");
const controller = require("../controllers/ticketController");

router.post("/", verify, controller.addTicket);
router.get("/", controller.getApprovedTickets);
router.get("/:id", verify, controller.getSingleTicket);
router.patch("/:id", verify, controller.updateTicket);
router.delete("/:id", verify, controller.deleteTicket);

module.exports = router;
