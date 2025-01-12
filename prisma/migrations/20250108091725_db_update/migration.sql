/*
  Warnings:

  - Changed the type of `paidBy` on the `Expenses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_paidBy_fkey";

-- AlterTable
ALTER TABLE "Expenses" DROP COLUMN "paidBy",
ADD COLUMN     "paidBy" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
