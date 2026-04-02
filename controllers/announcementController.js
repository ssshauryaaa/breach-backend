const prisma = require("../config/prisma");

// ------------------- GET ALL ANNOUNCEMENTS -------------------
// GET /announcements
// Optional query: ?type=ALERT
exports.getPublicAnnouncements = async (req, res) => {
  try {
    const { type } = req.query;

    const validTypes = ["INFO", "WARNING", "ALERT", "SUCCESS"];
    if (type && !validTypes.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of: ${validTypes.join(", ")}` });
    }

    const announcements = await prisma.announcement.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        createdAt: true,
      },
    });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};