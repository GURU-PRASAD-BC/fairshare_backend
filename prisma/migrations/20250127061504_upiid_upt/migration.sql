/*
  Warnings:

  - A unique constraint covering the columns `[upiID]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Settlements" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transactionID" TEXT,
ADD COLUMN     "upiID" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "upiID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_upiID_key" ON "User"("upiID");
