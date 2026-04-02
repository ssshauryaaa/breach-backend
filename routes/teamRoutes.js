const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/teamController");

router.post("/create", auth, controller.createTeam);
router.post("/join", auth, controller.joinTeam);

router.get("/me", auth, controller.getMyTeam);
router.get("/scoreboard", controller.getScoreboard);
router.get("/", controller.getTeams);

module.exports = router;
