-- CreateTable
CREATE TABLE "Matchup" (
    "id" TEXT NOT NULL,
    "redTeamId" TEXT NOT NULL,
    "blueTeamId" TEXT NOT NULL,
    "targetUrl" TEXT,
    "repoUrl" TEXT,
    "roundLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_redTeamId_fkey" FOREIGN KEY ("redTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_blueTeamId_fkey" FOREIGN KEY ("blueTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
