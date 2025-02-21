const prisma = require('../config/prismaClient');
const { Parser } = require('json2csv');
const { logActivity } = require("../utils/notifications");
const fs = require('fs');
const path = require('path');

//split-calc
exports.splitexpense=async (req, res) => {
  try {
      const { totalAmount, userSplits, type } = req.body;
      
      if (!totalAmount || !userSplits || !type) {
          return res.status(400).json({ message: 'Missing required fields' });
      }

      let calculatedSplits = [];
      let sumOfSplits = 0;

      switch (type) {
          case 'equal': {
              const splitAmount = (totalAmount / userSplits.length).toFixed(2);
              calculatedSplits = userSplits.map(userID => ({ userID, amount: parseFloat(splitAmount) }));
              sumOfSplits = calculatedSplits.reduce((sum, split) => sum + split.amount, 0);
              break;
          }
          case 'exact': {
              sumOfSplits = userSplits.reduce((sum, split) => sum + split.amount, 0);
              calculatedSplits = userSplits;
              break;
          }
          case 'percentage': {
              calculatedSplits = userSplits.map(({ userID, percentage }) => {
                  const amount = (totalAmount * (percentage / 100)).toFixed(2);
                  return { userID, amount: parseFloat(amount) };
              });
              sumOfSplits = calculatedSplits.reduce((sum, split) => sum + split.amount, 0);
              break;
          }
          case '+/-': {
              const baseAmount = (totalAmount / userSplits.length).toFixed(2);
              calculatedSplits = userSplits.map(({ userID, adjustment }) => {
                  return { userID, amount: parseFloat((parseFloat(baseAmount) + adjustment).toFixed(2)) };
              });
              sumOfSplits = calculatedSplits.reduce((sum, split) => sum + split.amount, 0);
              break;
          }
          default:
              return res.status(400).json({ message: 'Invalid split type' });
      }

      if (parseFloat(sumOfSplits.toFixed(2)) !== parseFloat(totalAmount.toFixed(2))) {
          return res.status(400).json({ message: 'Calculated split does not match total amount' });
      }

      return res.status(200).json({ splits: calculatedSplits });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

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
        amount: Number(amount), // Ensure amount is numeric
        description,
        paidBy,
        date: new Date(),
        type,
        groupID,
        category,
        image,
        splits: {
          create: splits.map((split) => ({
            userID: split.userID,
            amount: Number(split.amount), // Ensure split amount is numeric
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
        const netAmount = Number(reverseBalance.amountOwed) - Number(split.amount);

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
          data: {
            amountOwed: Number(existingBalance.amountOwed) + Number(split.amount),
          },
        });
      } else {
        // Create a new balance if neither exists
        await prisma.balances.create({
          data: {
            userID: split.userID,
            friendID: paidBy,
            amountOwed: Number(split.amount),
          },
        });
      }
    }

    // Log activity for the payer
    await logActivity({
      userID: paidBy,
      action: "expense_paid",
      description: `You paid ${Number(amount)} for an expense in group ${group.groupName}.`,
      io: req.io,
    });

    // Notify each user in the split
    for (const split of splits) {
      if (split.userID === paidBy) continue;

      await logActivity({
        userID: split.userID,
        action: "expense_shared",
        description: `An expense of ${Number(split.amount)} was shared with you in group ${group.groupName}.`,
        io: req.io,
      });
    }

    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add expense" });
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
  const { page = 1, limit = 10 } = req.query; 

  try {
    const skip = (page - 1) * limit; 
    const take = parseInt(limit, 10);

    const [expenses, totalExpenses] = await Promise.all([
      prisma.expenses.findMany({
        where: {
          OR: [
            { paidBy: Number(userID) },
            { splits: { some: { userID: Number(userID) } } },
          ],
        },
        include: {
          user: { select: { name: true } },
          group: { select: { groupName: true } },
          splits: { include: { user: { select: { name: true } } } },
        },
        skip,
        take,
      }),
      prisma.expenses.count({
        where: {
          OR: [
            { paidBy: Number(userID) },
            { splits: { some: { userID: Number(userID) } } },
          ],
        },
      }),
    ]);

    if (expenses.length === 0) {
      return res.status(404).json({ message: 'No expenses found for the user' });
    }

    // Format response
    const formattedExpenses = expenses.map((expense) => ({
      expenseID: expense.expenseID,
      amount: expense.amount.toString(),
      description: expense.description,
      paidBy: expense.user.name,
      date: expense.date.toISOString(),
      type: expense.type,
      category: expense.category,
      group: expense.group?.groupName || 'N/A',
    }));

    res.status(200).json({
      data: formattedExpenses,
      pagination: {
        total: totalExpenses,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(totalExpenses / take),
      },
    });
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
      return res.status(200).json({ message: 'No balances exist between you and the specified friend.' });
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


//settle expense/split
exports.settleExpense = async (req, res) => {
  const userID = req.user.userID;
  const { friendID, groupID, amount, upiID, transactionID } = req.body;

  //console.log(userID, friendID, groupID, amount, upiID, transactionID);

  try {
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

      // Log settlement with optional UPI transaction
      await prisma.settlements.create({
        data: {
          userID,
          friendID,
          amount: settlementAmount,
          upiID: upiID || null,
          transactionID: upiID ? transactionID || null : null,
          description: `Settled ${settlementAmount} with friend ${friend.name} via ${
            upiID ? "UPI" : "cash"
          }.`,
        },
      });

      // Log & Notify settlement activity
      await logActivity({
        userID: userID,
        action: 'settle_expense',
        description: `You settled ${settlementAmount} with friend ${friend.name}.`,
        io: req.io,
      });

      await logActivity({
        userID: friendID,
        action: 'settle_expense',
        description: `Your friend settled ${settlementAmount} with you.`,
        io: req.io,
      });

      return res.status(200).json({ message: "Balance settled successfully.", balance: newBalance });
    }

    if (groupID) {
      // Settle within a group
      const group = await prisma.group.findUnique({
        where: { groupID: groupID },
        select: { groupName: true},
      });

      if (group) {
        const groupExpenses = await prisma.expenses.findMany({
          where: { groupID},
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

        // Log the settlement with optional UPI transaction
        await prisma.settlements.create({
          data: {
            userID,
            groupID,
            amount: settlementAmount,
            upiID: upiID || null,
            transactionID: upiID ? transactionID || null : null,
            description: `Settled ${settlementAmount} in group ${group.groupName} via ${
              upiID ? "UPI" : "cash"
            }.`,
          },
        });

        // Log and notify settlement activity
        await logActivity({
          userID: userID,
          action: 'settle_group_expense',
          description: `You settled ${settlementAmount} in group ${group.groupName}.`,
          io: req.io,
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
    await logActivity({
      userID: userID,
      action: 'settle_all_expenses',
      description: `You settled all outstanding debts.`,
      io: req.io,
    });

    res.status(200).json({ message: 'All outstanding debts have been settled, and splits have been removed.' });
  } catch (error) {
    console.error("Error settling all owes:", error);
    res.status(500).json({ message: 'Failed to settle all debts.' });
  }
};

exports.getSettlements = async (req, res) => {
  const { userID } = req;
  try {
    const settlements = await prisma.settlements.findMany({
      where: {
        OR: [
          { userID: parseInt(userID) }, 
          { friendID: parseInt(userID) }, 
        ],
      },
      include: {
        friend: { select: { name: true } }, 
        group: { select: { groupName: true } }, 
      },
    });

    const transformedSettlements = settlements.map((settlement) => {
      return {
        id: settlement.id,
        amount: settlement.amount,
        timestamp: settlement.timestamp,
        description: settlement.description,
        name: settlement.friend?.name || settlement.group?.groupName || null, 
        type: settlement.friend ? "Friend" : settlement.group ? "Group" : null, 
        isVerified: settlement.friendID === parseInt(userID) || settlement.userID === parseInt(userID) ? settlement.isVerified : undefined, 
      };
    }).filter(settlement => settlement.name !== null);

    res.status(200).json(transformedSettlements);
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
};

//verify the settlement
exports.verifySettlement = async (req, res) => {
  const { settlementID } = req.params;
  const userID = req.user.userID; 
  try {
    // Fetch the settlement record
    const settlement = await prisma.settlements.findUnique({
      where: { id: Number(settlementID) },
      select: { userID: true }, 
    });

    if (!settlement) {
      return res.status(404).json({ message: "Settlement not found." });
    }

    if (settlement.friendID !== parseInt(userID)) {
      return res.status(403).json({ message: "You are not authorized to verify this settlement." });
    }

    const updatedSettlement = await prisma.settlements.update({
      where: { id: Number(settlementID) },
      data: { isVerified: true },
    });

    res.status(200).json(updatedSettlement);
  } catch (error) {
    console.error("Error verifying settlement:", error);
    res.status(500).json({ message: "Failed to verify settlement." });
  }
};


// Generate and download CSV for user expenses
exports.downloadExpensesCSV = async (req, res) => {
  const userID = req.user.userID;

  try {
    const expenses = await prisma.expenses.findMany({
      where: {
        OR: [
          { paidBy: Number(userID) },
          { splits: { some: { userID: Number(userID) } } },
        ],
      },
      include: {
        user: { select: { name: true } }, 
        group: { select: { groupName: true } }, 
        splits: { include: { user: { select: { name: true } } } }, 
      },
    });

    if (expenses.length === 0) {
      return res.status(404).json({ message: 'No expenses found for the user' });
    }

    // Format CSV
    const formattedExpenses = expenses.map((expense) => ({
      expenseID: expense.expenseID,
      amount: expense.amount.toString(),
      description: expense.description,
      paidBy: expense.user.name, 
      date: expense.date.toISOString(),
      type: expense.type,
      category: expense.category,
      group: expense.group?.groupName || 'N/A', 
    }));

    const fields = ['expenseID', 'amount', 'description', 'paidBy', 'date', 'type', 'category', 'group'];
    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(formattedExpenses);

    // Send CSV file for download
    res.header('Content-Type', 'text/csv');
    res.attachment(`user_expenses_${userID}.csv`);
    res.send(csvData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate CSV for user expenses' });
  }
};