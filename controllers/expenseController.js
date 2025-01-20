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

    console.log(updatedExpense);
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

// Get balance between logged-in user and a specific friend
// Get balance between logged-in user and a specific friend
exports.getBalanceWithFriend = async (req, res) => {
  const { userID } = req;
  const { friendID } = req.params;

  try {
    const balances = await prisma.balances.findMany({
      where: {
        OR: [
          { userID: Number(userID), friendID: Number(friendID) },
          { userID: Number(friendID), friendID: Number(userID) },
        ],
      },
      include: {
        user: { select: { userID: true, name: true } },
        friend: { select: { userID: true, name: true } },
      },
    });

    if (balances.length === 0) {
      return res.status(200).json({ message: 'No transactions exist between you and the specified friend.' });
    }

    const response = {
      iOwe: [],
      theyOweMe: [],
    };

    for (const balance of balances) {
      if (balance.userID === Number(userID)) {
        // Friend owes the logged-in user
        response.theyOweMe.push({
          friend: balance.friend,
          amountOwed: balance.amountOwed,
        });
      } else {
        // Logged-in user owes the friend
        response.iOwe.push({
          friend: balance.user,
          amountOwed: balance.amountOwed,
        });
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch balance with the friend' });
  }
};


//settle expenses
exports.settleExpense = async (req, res) => {
  const  userID = req.user.userID; 
  const { friendID, groupID, amount } = req.body;

  try {
    // Validate inputs
    if (!friendID && !groupID) {
      return res.status(400).json({ message: "Either 'friendID' or 'groupID' must be provided." });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid settlement amount." });
    }

    // Settle between two users
    if (friendID) {
      const balance = await prisma.balances.findFirst({
        where: {
          OR: [
            { userID, friendID },
            { userID: friendID, friendID: userID },
          ],
        },
      });

      if (!balance || balance.amountOwed === 0) {
        return res.status(400).json({ message: "No outstanding balance to settle with this friend." });
      }

      // Update the balance
      const newBalance =
        balance.userID === userID
          ? balance.amountOwed - amount
          : balance.amountOwed + amount;

      if (newBalance < 0) {
        return res.status(400).json({ message: "Settlement amount exceeds outstanding balance." });
      }

      await prisma.balances.update({
        where: { id: balance.id },
        data: { amountOwed: newBalance },
      });

      // Log settlement activity for both users
      await prisma.activities.create({
        data: {
          userID,
          action: 'settle_expense',
          description: `You settled ${amount} with friend ID ${friendID}.`,
        },
      });

      await prisma.activities.create({
        data: {
          userID: friendID,
          action: 'settle_expense',
          description: `Your friend (ID ${userID}) settled ${amount} with you.`,
        },
      });

      return res.status(200).json({ message: "Balance settled successfully.", balance: newBalance });
    }

    // Settle within a group
    if (groupID) {
      const groupExpenses = await prisma.expenses.findMany({
        where: { groupID },
        include: { splits: true },
      });

      if (!groupExpenses || groupExpenses.length === 0) {
        return res.status(400).json({ message: "No expenses found for this group." });
      }

      let totalOwed = 0;

      // Calculate the total amount owed by the user in the group
      groupExpenses.forEach((expense) => {
        expense.splits.forEach((split) => {
          if (split.userID === userID) {
            totalOwed += split.amount;
          }
        });
      });

      if (totalOwed === 0) {
        return res.status(400).json({ message: "No outstanding balance to settle in this group." });
      }

      if (amount > totalOwed) {
        return res.status(400).json({ message: "Settlement amount exceeds total outstanding balance in the group." });
      }

      // Settle the balance
      await prisma.balances.updateMany({
        where: { userID, groupID },
        data: { amountOwed: totalOwed - amount },
      });

       // Log the settlement
       await prisma.settlements.create({
        data: {
          userID,
          groupID,
          amount,
          description: `Settled ${amount} in group ID ${groupID}.`,
        },
      });

      // Log settlement activity
      await prisma.activities.create({
        data: {
          userID,
          action: 'settle_group_expense',
          description: `You settled ${amount} in group ID ${groupID}.`,
        },
      });

      return res.status(200).json({ message: "Group balance settled successfully." });
    }
  } catch (error) {
    console.error("Error settling expense:", error);
    res.status(500).json({ message: "Failed to settle expense." });
  }
};

// Get owes, owed-to summary
exports.getBalancesSummary = async (req, res) => {
  const { userID } = req;

  try {
    const balances = await prisma.balances.findMany({
      where: {
        OR: [
          { userID: Number(userID) },
          { friendID: Number(userID) },
        ],
      },
      include: {
        user: true,  // User details (payer/receiver)
        friend: true, // Friend details (receiver/payer)
      },
    });

    let totalOwes = 0;
    let totalOwedTo = 0;
    const summary = {};

    // Calculate totalOwes, totalOwedTo, and friend balances
    balances.forEach(balance => {
      const amountOwed = Number(balance.amountOwed); // Ensure numeric value

      if (balance.userID === Number(userID)) {
        totalOwes += amountOwed;
        summary[balance.friendID] = (summary[balance.friendID] || 0) - amountOwed;
      } else {
        totalOwedTo += amountOwed;
        summary[balance.userID] = (summary[balance.userID] || 0) + amountOwed;
      }
    });

    // Fetch friend details for each summary entry (friendID)
    const friendBalances = await Promise.all(
      Object.keys(summary).map(async (friendID) => {
        const friend = await prisma.user.findUnique({
          where: { userID: Number(friendID) },
          select: { userID: true, name: true}, 
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
    });

    if (balances.length === 0) {
      return res.status(200).json({ message: 'No outstanding debts to settle.' });
    }

    // Update all balances to settle owes
    const settlePromises = balances.map((balance) =>
      prisma.balances.update({
        where: { id: balance.id }, 
        data: { amountOwed: 0 }, // Set the amount owed to zero
      })
    );

    await Promise.all(settlePromises);

    // Log activity for the payer
    await prisma.activities.create({
      data: {
        userID: userID,
        action: 'all expense_paid',
        description: `You paid All outstanding debts`,
      },
    });

    res.status(200).json({ message: 'All outstanding debts have been settled.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to settle debts.' });
  }
};



