/*
  Warnings:

  - You are about to drop the column `categoryID` on the `Expenses` table. All the data in the column will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `category` to the `Expenses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_categoryID_fkey";

-- AlterTable
ALTER TABLE "Expenses" DROP COLUMN "categoryID",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "image" TEXT;

-- DropTable
DROP TABLE "Category";
