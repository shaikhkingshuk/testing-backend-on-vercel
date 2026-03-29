const router = require("express").Router();
const controller = require("../controllers/userController");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

router.post("/", controller.createUser);

router.get("/:email", verifyFirebaseToken, controller.getUserByEmail);

router.get("/", controller.getAllUsers);

router.patch("/:email", verifyFirebaseToken, controller.updateUserProfile);

module.exports = router;
