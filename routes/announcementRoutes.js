const express = require("express");
const router = express.Router();
const { getPublicAnnouncements } = require("../controllers/announcementController");

// ------------------- PUBLIC ANNOUNCEMENTS -------------------
// GET /announcements
// Optional query: ?type=ALERT
router.get("/", getPublicAnnouncements);

module.exports = router;