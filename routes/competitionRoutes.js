const express = require("express");
const router = express.Router();
const competitionController = require("../controllers/competitionController");
const auth = require("../middleware/authMiddleware");

// ==========================================================
// =================== ADMIN ROUTES =========================
// ==========================================================

// Create a new matchup
// POST /api/admin/matchups
router.post("/admin/matchups", competitionController.createMatchup);

// Get all matchups (optionally filter active)
// GET /api/admin/matchups?active=true
router.get("/admin/matchups", competitionController.getAllMatchups);

// Update a matchup by ID
// PATCH /api/admin/matchups/:id
router.patch("/admin/matchups/:id", competitionController.updateMatchup);

// Delete a matchup by ID
// DELETE /api/admin/matchups/:id
router.delete("/admin/matchups/:id", competitionController.deleteMatchup);

// Deactivate all matchups
// POST /api/admin/matchups/deactivate-all
router.post(
  "/admin/matchups/deactivate-all",
  competitionController.deactivateAllMatchups
);

// ==========================================================
// ================= PARTICIPANT ROUTES ====================
// ==========================================================

// Get the current user's active matchup
// GET /api/competition/my-matchup
router.get("/my-matchup",auth, competitionController.getMyMatchup);

module.exports = router;