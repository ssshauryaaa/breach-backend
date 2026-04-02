const prisma = require("../config/prisma");

const DEFENSE_POINTS = 5;

async function getTeamId(userId) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId },
  });

  if (!membership) throw new Error("User not in a team");

  return membership.teamId;
}

exports.patchVulnerability = async (req, res) => {
  try {
    const { type } = req.body; // vulnerability type

    const teamId = await getTeamId(req.user.id);

    await prisma.defenseLog.create({
      data: {
        teamId: teamId,
        type: type,
        success: true,
      },
    });

    res.json({ message: "Patch deployed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDefenseLogs = async (req, res) => {
  try {
    const teamId = await getTeamId(req.user.id);

    const logs = await prisma.defenseLog.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getIncomingAttacks = async (req, res) => {
  try {
    const teamId = await getTeamId(req.user.id);

    const attacks = await prisma.attackLog.findMany({
      where: {
        targetTeamId: teamId,
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
