const router = require("express").Router();
const controller = require("../controllers/homepageController");

router.get("/ads", controller.getHomepageAds);
router.get("/latest-tickets", controller.getLatestTickets);

module.exports = router;
