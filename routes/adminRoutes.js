const express = require("express");
const router = express.Router();

const admin = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

// All admin routes require a valid JWT AND role === "admin"
router.use(authMiddleware);
router.use(requireRole("admin"));

// ── Dashboard ────────────────────────────────────────────────
router.get("/dashboard", admin.getDashboard);

// ── Users ────────────────────────────────────────────────────
router.get("/users", admin.getAllUsers);
router.delete("/users/:id", admin.deleteUser);
router.patch("/users/:id/promote", admin.promoteUser);

// ── Teams ───────────────────────────────────────────────────
router.get("/teams", admin.getAllTeams);
router.post("/teams", admin.createTeam);
router.delete("/teams/:id", admin.deleteTeam);

// ── Team Membership ─────────────────────────────────────────
router.post("/teams/:teamId/members", admin.assignUserToTeam);
router.delete("/teams/:teamId/members/:userId", admin.removeUserFromTeam);

// ── Scoring ─────────────────────────────────────────────────
router.patch("/teams/:id/score", admin.adjustScore);
router.post("/scores/reset", admin.resetAllScores);

// ── Scoring Enhancements ────────────────────────────────────
router.post("/teams/:id/bonus", admin.awardBonusPoints);
router.post("/teams/:id/penalty", admin.deductPoints);
router.get("/scores/history", admin.getScoreHistory);
router.get("/teams/:id/score-history", admin.getTeamScoreHistory);
router.post("/scores/full-reset", admin.fullScoreReset);

// ── Logs ───────────────────────────────────────────────────
router.get("/logs/attacks", admin.getAttackLogs);
router.get("/logs/defenses", admin.getDefenseLogs);
router.delete("/logs", admin.clearAllLogs);

// ── Announcements ───────────────────────────────────────────
router.get("/announcements", admin.getAnnouncements);
router.post("/announcements", admin.createAnnouncement);
router.patch("/announcements/:id", admin.updateAnnouncement);
router.delete("/announcements/:id", admin.deleteAnnouncement);
router.delete("/announcements", admin.clearAllAnnouncements);

// ── Matchups ────────────────────────────────────────────────
router.get("/matchups", admin.getAllMatchups);
router.post("/matchups", admin.createMatchup);
router.patch("/matchups/:id", admin.updateMatchup);
router.delete("/matchups/:id", admin.deleteMatchup);
router.post("/matchups/deactivate-all", admin.deactivateAllMatchups);

module.exports = router;