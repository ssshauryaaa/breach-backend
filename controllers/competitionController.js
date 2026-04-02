const prisma = require("../config/prisma");

// =================================================================
// =================== COMPETITION CONTROLLER ======================
// =================================================================
// Handles 1v1 matchup creation, admin-configured URLs, and team
// lookups for the Red vs Blue finals format.
//
// Prisma models expected:
//
//   model Matchup {
//     id          String   @id @default(cuid())
//     redTeamId   String   @unique
//     blueTeamId  String   @unique
//     targetUrl   String?  // URL of vulnerable app (shown to Red + Blue)
//     repoUrl     String?  // GitHub repo URL (shown to Blue for reference)
//     roundLabel  String?  // e.g. "Finals Round 1"
//     isActive    Boolean  @default(true)
//     createdAt   DateTime @default(now())
//     updatedAt   DateTime @updatedAt
//
//     redTeam     Team     @relation("RedMatchup",  fields: [redTeamId],  references: [id])
//     blueTeam    Team     @relation("BlueMatchup", fields: [blueTeamId], references: [id])
//   }
//
// Add to Team model:
//   redMatchup   Matchup? @relation("RedMatchup")
//   blueMatchup  Matchup? @relation("BlueMatchup")
//
// =================================================================

// ------------------- helper: resolve team from session user -------------------
async function getTeamId(userId) {
  const member = await prisma.teamMember.findUnique({ where: { userId } });
  if (!member) throw new Error("User is not in a team");
  return member.teamId;
}

// =================================================================
// ====================== ADMIN ENDPOINTS ==========================
// =================================================================

// ------------------- CREATE MATCHUP -------------------
// POST /api/admin/matchups
// Body: { redTeamId, blueTeamId, targetUrl?, repoUrl?, roundLabel? }
// Assigns a Red team to face a Blue team. Both teams must exist.
// A team can only appear in one active matchup at a time.
exports.createMatchup = async (req, res) => {
  try {
    const { redTeamId, blueTeamId, targetUrl, repoUrl, roundLabel } = req.body;

    if (!redTeamId || !blueTeamId) {
      return res
        .status(400)
        .json({ error: "redTeamId and blueTeamId are required" });
    }
    if (redTeamId === blueTeamId) {
      return res
        .status(400)
        .json({ error: "A team cannot be matched against itself" });
    }

    // Validate both teams exist and have the correct roles
    const [red, blue] = await Promise.all([
      prisma.team.findUnique({ where: { id: redTeamId } }),
      prisma.team.findUnique({ where: { id: blueTeamId } }),
    ]);

    if (!red) return res.status(404).json({ error: "Red team not found" });
    if (!blue) return res.status(404).json({ error: "Blue team not found" });
    if (red.role !== "RED")
      return res
        .status(400)
        .json({ error: `Team "${red.name}" is not a RED team` });
    if (blue.role !== "BLUE")
      return res
        .status(400)
        .json({ error: `Team "${blue.name}" is not a BLUE team` });

    // Ensure neither team is already in an active matchup
    const existing = await prisma.matchup.findFirst({
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
    if (existing) {
      return res.status(409).json({
        error:
          "One or both teams are already assigned to an active matchup. Deactivate it first.",
        existingMatchupId: existing.id,
      });
    }

    const matchup = await prisma.matchup.create({
      data: {
        redTeamId,
        blueTeamId,
        targetUrl: targetUrl?.trim() ?? null,
        repoUrl: repoUrl?.trim() ?? null,
        roundLabel: roundLabel?.trim() ?? null,
        isActive: true,
      },
      include: {
        redTeam: { select: { id: true, name: true, score: true } },
        blueTeam: { select: { id: true, name: true, score: true } },
      },
    });

    res.status(201).json({ message: "Matchup created", matchup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- GET ALL MATCHUPS -------------------
// GET /api/admin/matchups
// Optional query: ?active=true  to filter active only
exports.getAllMatchups = async (req, res) => {
  try {
    const { active } = req.query;

    const matchups = await prisma.matchup.findMany({
      where:
        active === "true"
          ? { isActive: true }
          : active === "false"
            ? { isActive: false }
            : undefined,
      include: {
        redTeam: { select: { id: true, name: true, score: true, role: true } },
        blueTeam: {
          select: { id: true, name: true, score: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(matchups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- UPDATE MATCHUP -------------------
// PATCH /api/admin/matchups/:id
// Body: { targetUrl?, repoUrl?, roundLabel?, isActive? }
// Primary use: set or update the live target URL and repo URL mid-event.
exports.updateMatchup = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetUrl, repoUrl, roundLabel, isActive } = req.body;

    const data = {};
    if (targetUrl !== undefined) data.targetUrl = targetUrl.trim();
    if (repoUrl !== undefined) data.repoUrl = repoUrl.trim();
    if (roundLabel !== undefined) data.roundLabel = roundLabel.trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const matchup = await prisma.matchup.update({
      where: { id },
      data,
      include: {
        redTeam: { select: { id: true, name: true, score: true } },
        blueTeam: { select: { id: true, name: true, score: true } },
      },
    });

    // Emit real-time update so dashboards refresh immediately
    const io = req.app.get("io");
    if (io) {
      io.emit("matchup_updated", {
        matchupId: matchup.id,
        redTeamId: matchup.redTeamId,
        blueTeamId: matchup.blueTeamId,
        targetUrl: matchup.targetUrl,
        repoUrl: matchup.repoUrl,
      });
    }

    res.json({ message: "Matchup updated", matchup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------- DELETE MATCHUP -------------------
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

// ------------------- DEACTIVATE ALL MATCHUPS -------------------
// POST /api/admin/matchups/deactivate-all
// Use between rounds to clear the board before reassigning pairs.
exports.deactivateAllMatchups = async (req, res) => {
  try {
    const { count } = await prisma.matchup.updateMany({
      data: { isActive: false },
    });
    res.json({ message: `${count} matchup(s) deactivated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =================================================================
// ===================== PARTICIPANT ENDPOINTS =====================
// =================================================================

// ------------------- GET MY MATCHUP -------------------
// GET /api/competition/my-matchup
exports.getMyMatchup = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized: no user info" });
    }

    const teamId = await getTeamId(req.user.id);
    if (!teamId) {
      return res.status(404).json({ error: "Your team not found" });
    }

    // Find active matchup where this team is either red or blue
    const matchup = await prisma.matchup.findFirst({
      where: {
        isActive: true,
        OR: [{ redTeamId: teamId }, { blueTeamId: teamId }],
      },
      include: {
        redTeam: { select: { id: true, name: true, score: true, role: true } },
        blueTeam: { select: { id: true, name: true, score: true, role: true } },
      },
    });

    if (!matchup) {
      return res
        .status(404)
        .json({ error: "No active matchup found for your team" });
    }

    // Determine my team and opponent
    const myTeam = matchup.redTeamId === teamId ? matchup.redTeam : matchup.blueTeam;
    const opponent = matchup.redTeamId === teamId ? matchup.blueTeam : matchup.redTeam;
    const myRole = matchup.redTeamId === teamId ? "RED" : "BLUE";

    if (!myTeam) {
      return res.status(500).json({ error: "Your team info is missing in matchup" });
    }

    // Return safe response
    res.json({
      matchupId: matchup.id,
      roundLabel: matchup.roundLabel ?? null,
      targetUrl: matchup.targetUrl ?? null,
      repoUrl: matchup.repoUrl ?? null,
      myTeam,
      myRole,
      opponent: opponent
        ? {
            id: opponent.id,
            name: opponent.name,
            score: opponent.score,
            role: opponent.role,
          }
        : null, // opponent may not exist yet
    });
  } catch (err) {
    console.error("getMyMatchup error:", err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
  }
};