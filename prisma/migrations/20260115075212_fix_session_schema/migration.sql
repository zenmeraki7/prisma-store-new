/*
  Warnings:

  - You are about to drop the column `createdAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `session` table. All the data in the column will be lost.
  - Made the column `state` on table `session` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isOnline` on table `session` required. This step will fail if there are existing NULL values in that column.
  - Made the column `accessToken` on table `session` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "session_sessionId_key";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "createdAt",
DROP COLUMN "sessionId",
DROP COLUMN "updatedAt",
ADD COLUMN     "accountOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collaborator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpires" TIMESTAMP(3),
ADD COLUMN     "userId" BIGINT,
ALTER COLUMN "state" SET NOT NULL,
ALTER COLUMN "isOnline" SET NOT NULL,
ALTER COLUMN "isOnline" SET DEFAULT false,
ALTER COLUMN "accessToken" SET NOT NULL,
ALTER COLUMN "accessToken" SET DEFAULT '';
