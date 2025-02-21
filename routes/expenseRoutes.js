const express = require('express');
const router = express.Router();
const authenticateUser = require('../middlewares/validateUser');
const {
  splitexpense,
  addExpense,
  getExpensesByGroup,
  getUserExpenses,
  deleteExpense,
  updateExpense,
  getBalances,
  getBalanceWithFriend,
  settleExpense,
  getSettlements,
  verifySettlement,
  getBalancesSummary,
  settleAllOwes,
  downloadExpensesCSV
} = require('../controllers/expenseController');

// split expense
router.post('/split', authenticateUser, splitexpense);

// Add an expense
router.post('/add', authenticateUser, addExpense);
// Get all expenses for a specific group
router.get('/group/:groupID', authenticateUser, getExpensesByGroup);
// Get all expenses for a specific user
router.get('/user', authenticateUser, getUserExpenses);
// Delete an expense
router.delete('/:expenseID', authenticateUser, deleteExpense);
// Update an expense
router.put('/:expenseID', authenticateUser, updateExpense);
// Get balances for a user
router.get('/balances', authenticateUser, getBalances);
// Get balances for a user with friend
router.get('/balances/:friendID', authenticateUser,getBalanceWithFriend);
// Get Summary of balances
router.get('/balances-summary', authenticateUser,getBalancesSummary);
// Get Summary of balances
router.get('/csv', authenticateUser,downloadExpensesCSV);

// Settle an expense
router.post('/settle', authenticateUser, settleExpense);
// Get Settlements
router.get('/settle', authenticateUser, getSettlements);
// Settle all expenses
router.put('/settle/:settleID', authenticateUser, verifySettlement);
// Settle all expenses
router.post('/balances/settleAll', authenticateUser, settleAllOwes);

module.exports = router;
