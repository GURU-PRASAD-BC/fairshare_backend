/*
  Warnings:

  - Added the required column `createdBy` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupType` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Type" AS ENUM ('Home', 'Trip', 'Couple', 'Others');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "createdBy" INTEGER NOT NULL,
ADD COLUMN     "groupImage" TEXT,
ADD COLUMN     "groupType" "Type" NOT NULL;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
