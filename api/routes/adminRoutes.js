const router = require("express").Router();
const verify = require("../middleware/verifyFirebaseToken");
const userController = require("../controllers/userController");

router.get("/users", verify, userController.getAllUsers);

module.exports = router;
