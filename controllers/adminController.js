const prisma = require("../config/prisma");

let _io = null;
// Call this once from server.js after Socket.io is initialised
exports.setIO = (io) => {
  _io = io;
};

// ─────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────

/** Safely grab the Socket.io instance from either source */
function getIO(req) {
  return _io ?? req.app.get("io") ?? null;
}

/** Emit a socket event if io is available, otherwise silently skip */
function emit(req, event, payload) {
  const io = getIO(req);
  if (io) io.emit(event, payload);
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD OVERVIEW
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [userCount, teamCount, attackCount, defenseCount, teams] =
      await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.attackLog.count(),
        prisma.defenseLog.count(),
        prisma.team.findMany({
          select: {
            id: true,
            name: true,
            role: true,
            score: true,
            _count: { select: { members: true } },
          },
          orderBy: { score: "desc" },
        }),
      ]);

    res.json({
      stats: { userCount, teamCount, attackCount, defenseCount },
      leaderboard: teams,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        teamMember: {
          select: {
            team: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.teamMember.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/users/:id/promote
exports.promoteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { role: "admin" },
      select: { id: true, username: true, role: true },
    });

    res.json({ message: "User promoted to admin", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/teams
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, role: true } },
          },
        },
      },
      orderBy: { score: "desc" },
    });

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/teams  —  body: { name, role }
exports.createTeam = async (req, res) => {
  try {
    const { name, role } = req.body;

    if (!["RED", "BLUE"].includes(role)) {
      return res.status(400).json({ error: "Role must be RED or BLUE" });
    }

    const team = await prisma.team.create({ data: { name, role } });
    res.status(201).json({ message: "Team created", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/teams/:id
exports.deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    // Must clear dependent matchups before deleting the team
    await prisma.matchup.deleteMany({
      where: { OR: [{ redTeamId: id }, { blueTeamId: id }] },
    });

    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    await prisma.attackLog.deleteMany({
      where: { OR: [{ attackerId: id }, { targetTeamId: id }] },
    });
    await prisma.defenseLog.deleteMany({ where: { teamId: id } });
    await prisma.scoreHistory.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/teams/:teamId/members  —  body: { userId }
exports.assignUserToTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;

    const count = await prisma.teamMember.count({ where: { teamId } });
    if (count >= 4) {
      return res.status(400).json({ error: "Team is full (max 4 members)" });
    }

    const membership = await prisma.teamMember.upsert({
      where: { userId },
      update: { teamId },
      create: { userId, teamId },
    });

    res.json({ message: "User assigned to team", membership });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/teams/:teamId/members/:userId
exports.removeUserFromTeam = async (req, res) => {
  try {
    const { userId } = req.params;
    await prisma.teamMember.delete({ where: { userId } });
    res.json({ message: "User removed from team" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────

// PATCH /api/admin/teams/:id/score  —  body: { delta }
exports.adjustScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;

    if (typeof delta !== "number") {
      return res.status(400).json({ error: "delta must be a number" });
    }

    const team = await prisma.team.update({
      where: { id },
      data: { score: { increment: delta } },
    });

    res.json({ message: "Score updated", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/scores/reset
exports.resetAllScores = async (req, res) => {
  try {
    await prisma.team.updateMany({ data: { score: 0 } });
    res.json({ message: "All scores reset to 0" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/teams/:id/bonus  —  body: { points, reason }
exports.awardBonusPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;

    if (typeof points !== "number" || points <= 0) {
      return res.status(400).json({ error: "points must be a positive number" });
    }
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return res.status(400).json({ error: "reason is required for bonus points" });
    }

    const [team, historyEntry] = await prisma.$transaction([
      prisma.team.update({
        where: { id },
        data: { score: { increment: points } },
        select: { id: true, name: true, score: true, role: true },
      }),
      prisma.scoreHistory.create({
        data: { teamId: id, delta: points, reason: reason.trim(), type: "BONUS" },
      }),
    ]);

    res.json({
      message: `Bonus of +${points} awarded to ${team.name}`,
      team,
      historyEntry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/teams/:id/penalty  —  body: { points, reason }
exports.deductPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;

    if (typeof points !== "number" || points <= 0) {
      return res.status(400).json({
        error: "points must be a positive number (it will be deducted)",
      });
    }
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return res.status(400).json({ error: "reason is required for a penalty" });
    }

    const [team, historyEntry] = await prisma.$transaction([
      prisma.team.update({
        where: { id },
        data: { score: { decrement: points } },
        select: { id: true, name: true, score: true, role: true },
      }),
      prisma.scoreHistory.create({
        data: { teamId: id, delta: -points, reason: reason.trim(), type: "PENALTY" },
      }),
    ]);

    res.json({
      message: `Penalty of -${points} applied to ${team.name}`,
      team,
      historyEntry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/scores/history  —  query: ?teamId=xxx
exports.getScoreHistory = async (req, res) => {
  try {
    const { teamId } = req.query;

    const history = await prisma.scoreHistory.findMany({
      where: teamId ? { teamId } : undefined,
      include: { team: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    const grouped = history.reduce((acc, entry) => {
      if (!acc[entry.teamId]) acc[entry.teamId] = [];
      acc[entry.teamId].push(entry);
      return acc;
    }, {});

    res.json({ history, grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/teams/:id/score-history
exports.getTeamScoreHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [team, history] = await Promise.all([
      prisma.team.findUnique({
        where: { id },
        select: { id: true, name: true, role: true, score: true },
      }),
      prisma.scoreHistory.findMany({
        where: { teamId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!team) return res.status(404).json({ error: "Team not found" });

    let running = 0;
    const timeline = history.map((entry) => {
      running += entry.delta;
      return { ...entry, runningTotal: running };
    });

    res.json({ team, timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/scores/full-reset
exports.fullScoreReset = async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.scoreHistory.deleteMany(),
      prisma.team.updateMany({ data: { score: 0 } }),
    ]);

    res.json({ message: "All scores and score history reset for new round" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/logs/attacks  —  query: ?teamId=xxx
exports.getAttackLogs = async (req, res) => {
  try {
    const { teamId } = req.query;

    const logs = await prisma.attackLog.findMany({
      where: teamId ? { attackerId: teamId } : undefined,
      include: {
        attacker: { select: { id: true, name: true } },
        target:   { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/logs/defenses  —  query: ?teamId=xxx
exports.getDefenseLogs = async (req, res) => {
  try {
    const { teamId } = req.query;

    const logs = await prisma.defenseLog.findMany({
      where: teamId ? { teamId } : undefined,
      include: { team: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/logs
exports.clearAllLogs = async (req, res) => {
  try {
    await prisma.attackLog.deleteMany();
    await prisma.defenseLog.deleteMany();
    res.json({ message: "All logs cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────────

// POST /api/admin/announcements  —  body: { title, message, type }
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, type = "INFO" } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "title is required" });
    }
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "message is required" });
    }
    if (!["INFO", "WARNING", "ALERT", "SUCCESS"].includes(type)) {
      return res.status(400).json({ error: "type must be INFO, WARNING, ALERT, or SUCCESS" });
    }

    const announcement = await prisma.announcement.create({
      data: { title: title.trim(), message: message.trim(), type },
    });

    emit(req, "new_announcement", announcement);

    res.status(201).json({ message: "Announcement created", announcement });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/announcements  —  query: ?type=ALERT
exports.getAnnouncements = async (req, res) => {
  try {
    const { type } = req.query;

    const validTypes = ["INFO", "WARNING", "ALERT", "SUCCESS"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    }

    const announcements = await prisma.announcement.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
    });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/announcements/:id  —  body: { title?, message?, type?, pinned? }
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, pinned } = req.body;

    if (type && !["INFO", "WARNING", "ALERT", "SUCCESS"].includes(type)) {
      return res.status(400).json({ error: "type must be INFO, WARNING, ALERT, or SUCCESS" });
    }

    const data = {};
    if (title   !== undefined) data.title   = title.trim();
    if (message !== undefined) data.message = message.trim();
    if (type    !== undefined) data.type    = type;
    if (pinned  !== undefined) data.pinned  = Boolean(pinned);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const announcement = await prisma.announcement.update({ where: { id }, data });

    res.json({ message: "Announcement updated", announcement });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id } });

    emit(req, "delete_announcement", { id });

    res.json({ message: "Announcement deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/announcements
exports.clearAllAnnouncements = async (req, res) => {
  try {
    const { count } = await prisma.announcement.deleteMany();
    res.json({ message: `Cleared ${count} announcement(s)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// MATCHUPS
// ─────────────────────────────────────────────────────────────────
//
// Prisma model required (add to schema.prisma):
//
//   model Matchup {
//     id          String   @id @default(cuid())
//     redTeamId   String
//     blueTeamId  String
//     targetUrl   String?
//     repoUrl     String?
//     roundLabel  String?
//     isActive    Boolean  @default(true)
//     createdAt   DateTime @default(now())
//     updatedAt   DateTime @updatedAt
//
//     redTeam     Team     @relation("RedMatchup",  fields: [redTeamId],  references: [id])
//     blueTeam    Team     @relation("BlueMatchup", fields: [blueTeamId], references: [id])
//   }
//
// Add to Team model:
//   redMatchups   Matchup[] @relation("RedMatchup")
//   blueMatchups  Matchup[] @relation("BlueMatchup")
//
// ─────────────────────────────────────────────────────────────────

// POST /api/admin/matchups  —  body: { redTeamId, blueTeamId, targetUrl?, repoUrl?, roundLabel? }
exports.createMatchup = async (req, res) => {
  try {
    const { redTeamId, blueTeamId, targetUrl, repoUrl, roundLabel } = req.body;

    if (!redTeamId || !blueTeamId) {
      return res.status(400).json({ error: "redTeamId and blueTeamId are required" });
    }
    if (redTeamId === blueTeamId) {
      return res.status(400).json({ error: "A team cannot be matched against itself" });
    }

    // Validate both teams exist and carry the correct roles
    const [red, blue] = await Promise.all([
      prisma.team.findUnique({ where: { id: redTeamId } }),
      prisma.team.findUnique({ where: { id: blueTeamId } }),
    ]);

    if (!red)  return res.status(404).json({ error: "Red team not found" });
    if (!blue) return res.status(404).json({ error: "Blue team not found" });
    if (red.role  !== "RED")  return res.status(400).json({ error: `Team "${red.name}"  is not a RED team`  });
    if (blue.role !== "BLUE") return res.status(400).json({ error: `Team "${blue.name}" is not a BLUE team` });

    // Prevent double-booking either team in an active matchup
    const conflict = await prisma.matchup.findFirst({
      where: {
        isActive: true,
        OR: [
          { redTeamId },
          { blueTeamId },
          { redTeamId: blueTeamId },
          { blueTeamId: redTeamId },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        error: "One or both teams are already in an active matchup. Deactivate it first.",
        existingMatchupId: conflict.id,
      });
    }

    const matchup = await prisma.matchup.create({
      data: {
        redTeamId,
        blueTeamId,
        targetUrl:  targetUrl?.trim()  ?? null,
        repoUrl:    repoUrl?.trim()    ?? null,
        roundLabel: roundLabel?.trim() ?? null,
        isActive: true,
      },
      include: {
        redTeam:  { select: { id: true, name: true, score: true } },
        blueTeam: { select: { id: true, name: true, score: true } },
      },
    });

    res.status(201).json({ message: "Matchup created", matchup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/matchups  —  query: ?active=true|false
exports.getAllMatchups = async (req, res) => {
  try {
    const { active } = req.query;

    const where =
      active === "true"  ? { isActive: true  } :
      active === "false" ? { isActive: false } :
      undefined;

    const matchups = await prisma.matchup.findMany({
      where,
      include: {
        redTeam:  { select: { id: true, name: true, score: true, role: true } },
        blueTeam: { select: { id: true, name: true, score: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(matchups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/matchups/:id  —  body: { targetUrl?, repoUrl?, roundLabel?, isActive? }
exports.updateMatchup = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetUrl, repoUrl, roundLabel, isActive } = req.body;

    const data = {};
    if (targetUrl  !== undefined) data.targetUrl  = targetUrl.trim()  || null;
    if (repoUrl    !== undefined) data.repoUrl    = repoUrl.trim()    || null;
    if (roundLabel !== undefined) data.roundLabel = roundLabel.trim() || null;
    if (isActive   !== undefined) data.isActive   = Boolean(isActive);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const matchup = await prisma.matchup.update({
      where: { id },
      data,
      include: {
        redTeam:  { select: { id: true, name: true, score: true } },
        blueTeam: { select: { id: true, name: true, score: true } },
      },
    });

    // Push updated URLs to both teams' dashboards in real-time
    emit(req, "matchup_updated", {
      matchupId:  matchup.id,
      redTeamId:  matchup.redTeamId,
      blueTeamId: matchup.blueTeamId,
      targetUrl:  matchup.targetUrl,
      repoUrl:    matchup.repoUrl,
      isActive:   matchup.isActive,
    });

    res.json({ message: "Matchup updated", matchup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/matchups/:id
exports.deleteMatchup = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.matchup.delete({ where: { id } });
    res.json({ message: "Matchup deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/matchups/deactivate-all
exports.deactivateAllMatchups = async (req, res) => {
  try {
    const { count } = await prisma.matchup.updateMany({ data: { isActive: false } });
    res.json({ message: `${count} matchup(s) deactivated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PARTICIPANT-FACING — GET MY MATCHUP
// ─────────────────────────────────────────────────────────────────
// GET /api/competition/my-matchup   (mount on the competition router)
// Returns the calling team's active matchup: opponent info, targetUrl, repoUrl.
// Both Red and Blue teams use this same endpoint.

exports.getMyMatchup = async (req, res) => {
  try {
    const member = await prisma.teamMember.findUnique({
      where: { userId: req.user.id },
    });
    if (!member) {
      return res.status(404).json({ error: "You are not in a team" });
    }

    const teamId = member.teamId;

    const matchup = await prisma.matchup.findFirst({
      where: {
        isActive: true,
        OR: [{ redTeamId: teamId }, { blueTeamId: teamId }],
      },
      include: {
        redTeam:  { select: { id: true, name: true, score: true, role: true } },
        blueTeam: { select: { id: true, name: true, score: true, role: true } },
      },
    });

    if (!matchup) {
      return res.status(404).json({ error: "No active matchup found for your team" });
    }

    const isRed   = matchup.redTeamId === teamId;
    const myTeam  = isRed ? matchup.redTeam  : matchup.blueTeam;
    const opponent = isRed ? matchup.blueTeam : matchup.redTeam;

    res.json({
      matchupId:  matchup.id,
      roundLabel: matchup.roundLabel,
      targetUrl:  matchup.targetUrl,
      repoUrl:    matchup.repoUrl,
      myRole:     isRed ? "RED" : "BLUE",
      myTeam,
      opponent: {
        id:    opponent.id,
        name:  opponent.name,
        score: opponent.score,
        role:  opponent.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};