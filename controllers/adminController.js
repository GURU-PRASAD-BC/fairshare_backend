// controllers/adminController.js
const prisma = require('../config/prismaClient');

// User Management
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        userID: true,
        name: true,
        email: true,
        image: true,
        role: true,
      }
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

exports.blockUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true },
    });
    res.status(200).json({ message: `User ${user.name} has been blocked` });
  } catch (error) {
    res.status(500).json({ error: "Failed to block user" });
  }
};

exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.user.delete({ where: { id: userId } });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
};

exports.promoteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });
    res.status(200).json({ message: `User ${user.name} promoted to admin` });
  } catch (error) {
    res.status(500).json({ error: "Failed to promote user" });
  }
};

// Feedback Management
exports.getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany();
    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch feedbacks" });
  }
};

exports.resolveFeedback = async (req, res) => {
  const { feedbackId } = req.params;
  try {
    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: { resolved: true },
    });
    res.status(200).json({ message: `Feedback ${feedbackId} marked as resolved` });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve feedback" });
  }
};

// Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    const groupsCount = await prisma.group.count();
    const expensesCount = await prisma.expense.count();

    res.status(200).json({
      users: usersCount,
      groups: groupsCount,
      expenses: expensesCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
};
