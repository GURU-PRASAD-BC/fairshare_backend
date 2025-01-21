const prisma = require('../config/prismaClient');

// Add an expense
exports.addExpense = async (req, res) => {
  const { amount, description, paidBy, groupID, type, category, splits, image } = req.body;

  const group = await prisma.group.findUnique({
    where: { groupID },
    select: { groupName: true }, 
  });

  try {
    const expense = await prisma.expenses.create({
      data: {
        amount,
        description,
        paidBy,
        date: new Date(),
        type,
        groupID,
        category,
        image,
        splits: {
          create: splits.map(split => ({
            userID: split.userID,
            amount: split.amount,
          })),
        },
      },
    });

    for (const split of splits) {
      if (split.userID === paidBy) continue; // Skip the payer

      // Check for existing balances
      const existingBalance = await prisma.balances.findFirst({
        where: { userID: split.userID, friendID: paidBy },
      });

      const reverseBalance = await prisma.balances.findFirst({
        where: { userID: paidBy, friendID: split.userID },
      });

      if (reverseBalance) {
        // Subtract from the reverse balance to calculate the net balance
        const netAmount = reverseBalance.amountOwed - split.amount;

        if (netAmount > 0) {
          // Update reverse balance with reduced amount
          await prisma.balances.update({
            where: { id: reverseBalance.id },
            data: { amountOwed: netAmount },
          });
        } else if (netAmount < 0) {
          // Delete reverse balance and create a new forward balance
          await prisma.balances.delete({
            where: { id: reverseBalance.id },
          });
          await prisma.balances.create({
            data: {
              userID: split.userID,
              friendID: paidBy,
              amountOwed: -netAmount, // Positive amount for the forward balance
            },
          });
        } else {
          // If netAmount is 0, delete the reverse balance
          await prisma.balances.delete({
            where: { id: reverseBalance.id },
          });
        }
      } else if (existingBalance) {
        // If no reverse balance, update the forward balance
        await prisma.balances.update({
          where: { id: existingBalance.id },
          data: { amountOwed: existingBalance.amountOwed + split.amount },
        });
      } else {
        // Create a new balance if neither exists
        await prisma.balances.create({
          data: {
            userID: split.userID,
            friendID: paidBy,
            amountOwed: split.amount,
          },
        });
      }
    }

    // Log activity for the payer
    await prisma.activities.create({
      data: {
        userID: paidBy,
        action: 'expense_paid',
        description: `You paid ${amount} for an expense in group ID ${group.groupName}.`,
      },
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add expense' });
  }
};


exports.getExpensesByGroup = async (req, res) => {
  const { groupID } = req.params;

  try {
    const expenses = await prisma.expenses.findMany({
      where: { groupID: Number(groupID) },
      include: {
        splits: {
          include: {
            user: {
              select: {
                userID: true,
                name: true,
              },
            },
          },
        },
        user: { //user who paid
          select: {
            userID: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch group expenses' });
  }
};


// Get expenses by user
exports.getUserExpenses = async (req, res) => {
  const userID = req.user.userID;

  try {
    const expenses = await prisma.expenses.findMany({
      where: { paidBy: Number(userID) },
      include: {splits: true},
    });

    res.status(200).json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch user expenses' });
  }
};

// Delete an expense
exports.deleteExpense = async (req, res) => {
  const { expenseID } = req.params;

  try {
    await prisma.expenseSplit.deleteMany({
      where: { expenseID: Number(expenseID) }
    });

    await prisma.expenses.delete({
      where: { expenseID: Number(expenseID) }
    });

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete expense' });
  }
};

// Update an expense
exports.updateExpense = async (req, res) => {
  const { expenseID } = req.params;
  const {description, category } = req.body;

  try {
    const updatedExpense = await prisma.expenses.update({
      where: { expenseID: Number(expenseID) },
      data: {description, category },
    });

    // console.log(updatedExpense);
    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update expense' });
  }
};

// Get balances for a user
exports.getBalances = async (req, res) => {
  const { userID } = req;

  try {
    const balances = await prisma.balances.findMany({
      where: { userID: Number(userID) },
      include: { user: true, friend: true },
    });

    res.status(200).json(balances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch balances' });
  }
};

exports.getBalanceWithFriend = async (req, res) => {
  const { userID } = req;
  const { friendID } = req.params;

  try {
    // Find all expense splits involving both the logged-in user and the friend
    const expensesWithFriend = await prisma.expenses.findMany({
      where: {
        OR: [
          { paidBy: Number(userID), splits: { some: { userID: Number(friendID) } } },
          { paidBy: Number(friendID), splits: { some: { userID: Number(userID) } } },
        ],
      },
      include: { splits: true },
    });

    if (expensesWithFriend.length === 0) {
      return res.status(200).json({ message: 'No transactions exist between you and the specified friend.' });
    }

    let iOwe = 0;
    let theyOweMe = 0;

    // Calculate balances
    expensesWithFriend.forEach((expense) => {
      expense.splits.forEach((split) => {
        if (split.userID === Number(userID) && expense.paidBy === Number(friendID)) {
          iOwe += Number(split.amount);
        } else if (split.userID === Number(friendID) && expense.paidBy === Number(userID)) {
          theyOweMe += Number(split.amount);
        }
      });
    });

    res.status(200).json({
      iOwe,
      theyOweMe,
      balance: theyOweMe - iOwe, // Positive if the friend owes you, negative if you owe the friend
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch balance with the friend' });
  }
};

exports.getBalancesSummary = async (req, res) => {
  const { userID } = req;

  try {
    // Fetch all expenses involving the user
    const userExpenses = await prisma.expenses.findMany({
      where: {
        OR: [
          { paidBy: Number(userID) }, // User is the payer
          { splits: { some: { userID: Number(userID) } } }, // User is in splits
        ],
      },
      include: { splits: true },
    });

    let totalOwes = 0;
    let totalOwedTo = 0;
    const summary = {};

    // Calculate balances
    userExpenses.forEach((expense) => {
      expense.splits.forEach((split) => {
        if (split.userID === Number(userID)) {
          // User owes the payer
          if (!summary[expense.paidBy]) summary[expense.paidBy] = 0;
          summary[expense.paidBy] += Number(split.amount);
          totalOwes += Number(split.amount);
        } else if (expense.paidBy === Number(userID)) {
          // Others owe the user
          if (!summary[split.userID]) summary[split.userID] = 0;
          summary[split.userID] -= Number(split.amount);
          totalOwedTo += Number(split.amount);
        }
      });
    });

    // Fetch friend details for each summary entry
    const friendBalances = await Promise.all(
      Object.keys(summary).map(async (friendID) => {
        const friend = await prisma.user.findUnique({
          where: { userID: Number(friendID) },
          select: { userID: true, name: true },
        });

        return {
          friendID: Number(friendID),
          balance: summary[friendID],
          friendName: friend ? friend.name : 'Unknown',
        };
      })
    );

    res.status(200).json({
      totalOwes,
      totalOwedTo,
      friendBalances,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch balances summary' });
  }
};


exports.settleExpense = async (req, res) => {
  const userID = req.user.userID;
  const { friendID, groupID, amount } = req.body;
  console.log(userID,friendID, groupID, amount);
  try {
    // Validate inputs
    if (!friendID && !groupID) {
      return res.status(400).json({ message: "Either 'friendID' or 'groupID' must be provided." });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: "Invalid settlement amount." });
    }

    const settlementAmount = Number(amount); // Ensure amount is a number

    if (friendID) {
      // Settle between two users
      const balance = await prisma.balances.findFirst({
        where: {
          OR: [
            { userID, friendID },
            { userID: friendID, friendID: userID },
          ],
        },
      });

      if (!balance || Number(balance.amountOwed) === 0) {
        return res.status(400).json({ message: "No outstanding balance to settle with this friend." });
      }

      // Fetch friend's name
      const friend = await prisma.user.findUnique({
        where: { userID: friendID },
        select: { name: true },
      });
      if (!friend) {
        return res.status(404).json({ message: "Friend not found." });
      }

      const currentBalance = Number(balance.amountOwed);
      const newBalance =
        balance.userID === userID
          ? currentBalance - settlementAmount
          : currentBalance + settlementAmount;

      if (newBalance < 0) {
        return res.status(400).json({ message: "Settlement amount exceeds outstanding balance." });
      }

      // Update or remove the balance
      if (newBalance === 0) {
        await prisma.balances.delete({ where: { id: balance.id } });
      } else {
        await prisma.balances.update({
          where: { id: balance.id },
          data: { amountOwed: newBalance },
        });
      }

      // Remove splits involving the user
      await prisma.expenseSplit.deleteMany({
        where: {
          userID,
          expense: {
            OR: [
              { paidBy: friendID },
              { splits: { some: { userID: friendID } } },
            ],
          },
        },
      });

      // Log settlement activity
      await prisma.activities.create({
        data: {
          userID,
          action: 'settle_expense',
          description: `You settled ${settlementAmount} with friend ID ${friend.name}.`,
        },
      });

      await prisma.activities.create({
        data: {
          userID: friendID,
          action: 'settle_expense',
          description: `Your friend settled ${settlementAmount} with you.`,
        },
      });

      return res.status(200).json({ message: "Balance settled successfully.", balance: newBalance });
    }

    if (groupID) {
      // Settle within a group
      const group = await prisma.group.findUnique({
        where: { groupID: groupID },
        select: { groupName: true },
      });
    
      if (group) {
        const groupExpenses = await prisma.expenses.findMany({
          where: { groupID },
          include: { splits: true },
        });
    
        if (!groupExpenses || groupExpenses.length === 0) {
          return res.status(400).json({ message: "No expenses found for this group." });
        }
    
        let totalOwed = 0;
        const userSplits = [];
    
        // Calculate the total owed by the user in the group and track their splits
        groupExpenses.forEach((expense) => {
          expense.splits.forEach((split) => {
            if (split.userID === userID) {
              totalOwed += Number(split.amount);
              userSplits.push({ splitID: split.id, expenseID: split.expenseID, amount: Number(split.amount) });
            }
          });
        });
    
        if (settlementAmount > totalOwed) {
          return res.status(400).json({ message: "Settlement amount exceeds total outstanding balance in the group." });
        }
    
        let remainingSettlement = settlementAmount;
    
        // Adjust splits based on the settlement amount
        for (const split of userSplits) {
          if (remainingSettlement <= 0) break;
    
          if (split.amount <= remainingSettlement) {
            // Fully settle this split
            await prisma.expenseSplit.delete({
              where: { id: split.splitID },
            });
            remainingSettlement -= split.amount;
          } else {
            // Partially settle this split
            await prisma.expenseSplit.update({
              where: { id: split.splitID },
              data: { amount: split.amount - remainingSettlement },
            });
            remainingSettlement = 0;
          }
        }
    
        // Log the settlement
        await prisma.settlements.create({
          data: {
            userID,
            groupID,
            amount: settlementAmount,
            description: `Settled ${settlementAmount} in group ID ${groupID}.`,
          },
        });
    
        // Log settlement activity
        await prisma.activities.create({
          data: {
            userID,
            action: 'settle_group_expense',
            description: `You settled ${settlementAmount} in group ${group.groupName}.`,
          },
        });
    
        return res.status(200).json({ message: "Group balance settled successfully." });
      }
    }    
  } catch (error) {
    console.error("Error settling expense:", error);
    res.status(500).json({ message: "Failed to settle expense." });
  }
};

// Settle all owes for a user
exports.settleAllOwes = async (req, res) => {
  const { userID } = req;

  try {
    // Fetch all balances where the user owes money
    const balances = await prisma.balances.findMany({
      where: {
        userID: Number(userID),
        amountOwed: { gt: 0 },
      },
      include: {
        expense: true, // Include related expenses for splits
      },
    });

    if (balances.length === 0) {
      return res.status(200).json({ message: 'No outstanding debts to settle.' });
    }

    // Update all balances to settle owes
    const settlePromises = balances.map(async (balance) => {
      // Remove splits for the settled balances
      await prisma.expenseSplit.deleteMany({
        where: {
          userID: Number(userID),
          expenseID: balance.expense.id,
        },
      });

      // Update balance to zero
      return prisma.balances.update({
        where: { id: balance.id },
        data: { amountOwed: 0 },
      });
    });

    await Promise.all(settlePromises);

    // Log activity for the payer
    await prisma.activities.create({
      data: {
        userID: userID,
        action: 'settle_all_expenses',
        description: `You settled all outstanding debts.`,
      },
    });

    res.status(200).json({ message: 'All outstanding debts have been settled, and splits have been removed.' });
  } catch (error) {
    console.error("Error settling all owes:", error);
    res.status(500).json({ message: 'Failed to settle all debts.' });
  }
};
