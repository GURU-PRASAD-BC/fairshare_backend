-- DropForeignKey
ALTER TABLE "ExpenseSplit" DROP CONSTRAINT "ExpenseSplit_expenseID_fkey";

-- CreateTable
CREATE TABLE "Settlements" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "friendID" INTEGER,
    "groupID" INTEGER,
    "amount" DECIMAL(20,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "Settlements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_expenseID_fkey" FOREIGN KEY ("expenseID") REFERENCES "Expenses"("expenseID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlements" ADD CONSTRAINT "Settlements_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlements" ADD CONSTRAINT "Settlements_friendID_fkey" FOREIGN KEY ("friendID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlements" ADD CONSTRAINT "Settlements_groupID_fkey" FOREIGN KEY ("groupID") REFERENCES "Group"("groupID") ON DELETE SET NULL ON UPDATE CASCADE;
