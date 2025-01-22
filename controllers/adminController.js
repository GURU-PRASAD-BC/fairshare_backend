// controllers/adminController.js
const prisma = require('../config/prismaClient');
const { sendMail } = require("../utils/mailer");

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
    // Block the user
    const user = await prisma.user.update({
      where: { userID: parseInt(userId) },
      data: { isBlocked: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Notify the user's friends about the block
    const friends = await prisma.friends.findMany({
      where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] },
    });

    if (friends.length > 0) {
      const activities = friends.map((friend) => ({
        userID: friend.userID === parseInt(userId)
          ? parseInt(friend.friendID)
          : parseInt(friend.userID),
        action: "User Blocked",
        description: `${user.name} has been blocked.`,
      }));

      await prisma.activities.createMany({ data: activities });
    }

    // Send email to the user
    const subject = "Account Blocked on FinestShare";
    const htmlContent = `
      <p>Dear ${user.name},</p>
      <p>Your account has been temporarily blocked. Please contact support for more details.</p>
      <br />
      <p>Thank you,<br />FinestShare Team</p>
    `;
    await sendMail(user.email, subject, htmlContent);

    res.status(200).json({ message: `User ${user.name} has been blocked` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to block user" });
  }
};

exports.unblockUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Unblock the user
    const user = await prisma.user.update({
      where: { userID: parseInt(userId) },
      data: { isBlocked: false },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Notify the user's friends about the unblock
    const friends = await prisma.friends.findMany({
      where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] },
    });

    if (friends.length > 0) {
      const activities = friends.map((friend) => ({
        userID: friend.userID === parseInt(userId) 
          ? parseInt(friend.friendID) 
          : parseInt(friend.userID),
        action: "User Unblocked",
        description: `${user.name} has been unblocked.`,
      }));

      await prisma.activities.createMany({ data: activities });
    }

    // Send email to the user
    const subject = "Account Unblocked on FinestShare";
    const htmlContent = `
      <p>Dear ${user.name},</p>
      <p>Your account has been unblocked. Thank you for your patience.</p>
      <br />
      <p>Thank you,<br />FinestShare Team</p>
    `;
    await sendMail(user.email, subject, htmlContent);

    res.status(200).json({ message: `User ${user.name} has been unblocked` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to unblock user" });
  }
};

exports.deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const expenseCount = await prisma.expenses.count({
      where: { paidBy: parseInt(userId) },
    });
    const splitCount = await prisma.expenseSplit.count({
      where: { userID: parseInt(userId) },
    });
    const balanceCount = await prisma.balances.count({
      where: {
        OR: [
          { friendID: parseInt(userId) },
          { userID: parseInt(userId) }, 
        ],
      },
    });

    if (expenseCount > 0 || splitCount > 0 || balanceCount>0) {
      return res.status(403).json({
        message: "User cannot be deleted because they are involved in some expenses (or) transactions.",
      });
    }

    // Delete all related entities in the correct order
    await prisma.$transaction([
      prisma.friends.deleteMany({ where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] } }),
      prisma.groupMember.deleteMany({ where: { userID: parseInt(userId) } }),
      prisma.activities.deleteMany({ where: { userID: parseInt(userId) } }),
      prisma.group.deleteMany({ where: { createdBy: parseInt(userId) } }),
      prisma.user.delete({ where: { userID: parseInt(userId) } }),
    ]);

    // Send email to the user
    const user = await prisma.user.findUnique({
      where: { userID: parseInt(userId) },
    });

    if (user) {
      const subject = "Account Deleted on FinestShare";
      const htmlContent = `
        <p>Dear ${user.name},</p>
        <p>Your account has been successfully deleted from FinestShare.</p>
        <br />
        <p>Thank you,<br />FinestShare Team</p>
      `;
      await sendMail(user.email, subject, htmlContent);
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

exports.promoteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.update({
      where: { userID: Number(userId) },
      data: { role: 'ADMIN' },
    });
    console.log(user);
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
      where: { id: parseInt(feedbackId) },
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
    const expensesCount = await prisma.expenses.count();

    res.status(200).json({
      users: usersCount,
      groups: groupsCount,
      expenses: expensesCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
};
