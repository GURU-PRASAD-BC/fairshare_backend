const express = require('express');
const { isAdmin } = require('../middlewares/authMiddleware'); // Middleware to verify admin access
const {
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  promoteUser,
  getAllFeedback,
  resolveFeedback,
  getAnalytics,
} = require('../controllers/adminController');

const router = express.Router();

// User Management
router.get('/users', isAdmin, getAllUsers);
router.post('/users/block/:userId', isAdmin, blockUser);
router.post('/users/unblock/:userId', isAdmin, unblockUser);
router.delete('/users/:userId', isAdmin, deleteUser);
router.put('/users/promote/:userId', isAdmin, promoteUser);

// Feedback Management
router.get('/feedback', isAdmin, getAllFeedback);
router.post('/feedback/resolve/:feedbackId', isAdmin, resolveFeedback);

// Analytics
router.get('/analytics', isAdmin, getAnalytics);

module.exports = router;
