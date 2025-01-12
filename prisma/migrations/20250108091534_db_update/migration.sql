-- DropForeignKey
ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_paidBy_fkey";

-- AlterTable
ALTER TABLE "Expenses" ALTER COLUMN "paidBy" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
