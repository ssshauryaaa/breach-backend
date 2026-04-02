/*
  Warnings:

  - You are about to drop the column `joinedAt` on the `TeamMember` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AttackType" AS ENUM ('SQL_INJECTION', 'XSS', 'AUTH_BYPASS');

-- AlterTable
ALTER TABLE "TeamMember" DROP COLUMN "joinedAt";

-- CreateTable
CREATE TABLE "AttackLog" (
    "id" TEXT NOT NULL,
    "type" "AttackType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "attackerId" TEXT NOT NULL,
    "targetTeamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttackLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefenseLog" (
    "id" TEXT NOT NULL,
    "type" "AttackType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefenseLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AttackLog" ADD CONSTRAINT "AttackLog_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackLog" ADD CONSTRAINT "AttackLog_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefenseLog" ADD CONSTRAINT "DefenseLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
