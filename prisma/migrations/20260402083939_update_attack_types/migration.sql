/*
  Warnings:

  - The values [XSS,AUTH_BYPASS] on the enum `AttackType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AttackType_new" AS ENUM ('SQL_INJECTION', 'MISCONFIG', 'SENSITIVE_DATA_EXPOSURE', 'BROKEN_AUTHENTICATION', 'JWT_VULNERABILITY');
ALTER TABLE "AttackLog" ALTER COLUMN "type" TYPE "AttackType_new" USING ("type"::text::"AttackType_new");
ALTER TABLE "DefenseLog" ALTER COLUMN "type" TYPE "AttackType_new" USING ("type"::text::"AttackType_new");
ALTER TYPE "AttackType" RENAME TO "AttackType_old";
ALTER TYPE "AttackType_new" RENAME TO "AttackType";
DROP TYPE "public"."AttackType_old";
COMMIT;
