const prisma = require("../config/prisma");

exports.createTeam = async (req, res) => {
  try {
    const { name, role } = req.body;

    const team = await prisma.team.create({
      data: {
        name,
        role,
        score: 0,
      },
    });

    res.json({ team_id: team.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.joinTeam = async (req, res) => {
  try {
    const { team_id } = req.body;

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id: team_id },
      include: { members: true },
    });
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Check if user already in a team
    const existing = await prisma.teamMember.findUnique({
      where: { userId: req.user.id },
    });
    if (existing)
      return res.status(400).json({ error: "User already in a team" });

    // Add user to team
    await prisma.teamMember.create({
      data: {
        userId: req.user.id,
        teamId: team_id,
      },
    });

    res.json({ message: "Joined team" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyTeam = async (req, res) => {
  // console.log("TOKEN USER:", req.user);
  try {
    const membership = await prisma.teamMember.findMany({
      where: { userId: req.user.id },
      include: { team: true },
    });

    // console.log("Membership records:", membership);

    if (membership.length === 0) return res.json(null);

    res.json(membership[0].team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getScoreboard = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: {
        score: "desc",
      },
    });

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTeams = async (req, res) => {
  try {
    // fetch all teams with member counts
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        _count: {
          select: { members: true }, // assumes your Prisma model has "members" relation
        },
      },
    });

    // disable caching to avoid 304 issues
    res.set("Cache-Control", "no-store");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
