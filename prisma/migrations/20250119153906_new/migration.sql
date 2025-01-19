/*
  Warnings:

  - You are about to alter the column `amountOwed` on the `Balances` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(20,2)`.
  - You are about to alter the column `amount` on the `ExpenseSplit` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(20,2)`.
  - You are about to alter the column `amount` on the `Expenses` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(20,2)`.

*/
-- AlterTable
ALTER TABLE "Balances" ALTER COLUMN "amountOwed" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "ExpenseSplit" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Expenses" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(20,2);
