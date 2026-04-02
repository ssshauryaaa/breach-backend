const prisma = require("../config/prisma");

async function getTeamId(userId) {
  const member = await prisma.teamMember.findUnique({
    where: { userId },
  });

  if (!member) throw new Error("User not in a team");

  return member.teamId;
}

exports.submitAttack = async (req, res) => {
  try {
    const { targetTeamId, type } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Attack type required" });
    }

    const attackerId = await getTeamId(req.user.id);

    const attack = await prisma.attackLog.create({
      data: {
        attackerId,
        targetTeamId,
        type, // ✅ REQUIRED
        success: true,
      },
    });

    res.json({
      message: "Attack submitted",
      attack,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAttackHistory = async (req, res) => {
  try {
    const teamId = await getTeamId(req.user.id);

    const attacks = await prisma.attackLog.findMany({
      where: {
        attackerId: teamId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(attacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTargets = async (req, res) => {
  try {
    const teamId = await getTeamId(req.user.id);

    const teams = await prisma.team.findMany({
      where: {
        id: { not: teamId },
        role: "BLUE", // ✅ only blue teams
      },
      select: {
        id: true,
        name: true,
        score: true,
      },
    });

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
