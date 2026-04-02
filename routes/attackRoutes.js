const express = require("express");
const router = express.Router();

const attackController = require("../controllers/attackController");
const auth = require("../middleware/authMiddleware");

/*
Attack routes
*/

router.post("/submit", auth, attackController.submitAttack);

router.get("/history", auth, attackController.getAttackHistory);

router.get("/targets", auth, attackController.getTargets);

module.exports = router;
