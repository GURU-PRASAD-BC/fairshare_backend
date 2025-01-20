const express = require('express');
const router = express.Router();
const authenticateUser = require('../middlewares/validateUser');
const {
  addExpense,
  getExpensesByGroup,
  getUserExpenses,
  deleteExpense,
  updateExpense,
  getBalances,
  getBalanceWithFriend,
  settleExpense,
  getBalancesSummary,
  addCategory,
} = require('../controllers/expenseController');

// Add an expense
router.post('/add', authenticateUser, addExpense);
// Get all expenses for a specific group
router.get('/group/:groupID', authenticateUser, getExpensesByGroup);
// Get all expenses for a specific user
router.get('/user/:userID', authenticateUser, getUserExpenses);
// Delete an expense
router.delete('/:expenseID', authenticateUser, deleteExpense);
// Update an expense
router.put('/:expenseID', authenticateUser, updateExpense);
// Get balances for a user
router.get('/balances', authenticateUser, getBalances);
// Get balances for a user with friend
// Add this to your route file
router.get('/balances/:friendID', authenticateUser,getBalanceWithFriend);
// Get Summary of balances
router.get('/balances-summary', authenticateUser,getBalancesSummary);

// Settle an expense
router.post('/settle', authenticateUser, settleExpense);


module.exports = router;
