-- DropForeignKey
ALTER TABLE "Balances" DROP CONSTRAINT "Balances_friendID_fkey";

-- AlterTable
ALTER TABLE "Balances" ADD COLUMN     "groupID" INTEGER,
ALTER COLUMN "friendID" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_friendID_fkey" FOREIGN KEY ("friendID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_groupID_fkey" FOREIGN KEY ("groupID") REFERENCES "Group"("groupID") ON DELETE SET NULL ON UPDATE CASCADE;
