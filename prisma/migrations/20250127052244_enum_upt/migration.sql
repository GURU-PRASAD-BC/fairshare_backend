-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
