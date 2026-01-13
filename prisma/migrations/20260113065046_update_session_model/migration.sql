-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "accountOwner" BOOLEAN,
ADD COLUMN     "collaborator" BOOLEAN,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpires" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "isOnline" DROP DEFAULT;
