const express = require("express");
const router = express.Router();

const defenseController = require("../controllers/defenseController");
const auth = require("../middleware/authMiddleware");

router.post("/patch", auth, defenseController.patchVulnerability);
router.get("/logs", auth, defenseController.getDefenseLogs);
router.get("/attacks", auth, defenseController.getIncomingAttacks);

module.exports = router;
