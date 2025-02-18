// controllers/adminController.js
const prisma = require('../config/prismaClient');
const { sendMail } = require("../utils/mailer");
const { logActivity } = require("../utils/notifications");

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
        isBlocked: true,
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
    //Get User
    const user = await prisma.user.findUnique({
      where: { userID: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (user.role == 'ADMIN') {
      return res.status(403).json({ error: "You can't block another admin" });
    }

    // Block the user
    const block = await prisma.user.update({
      where: { userID: parseInt(userId) },
      data: { isBlocked: true },
    });

    // Log activity for the blocked user
    await logActivity({
      userID: user.userID,
      action: "account_blocked",
      description: `Your account has been blocked.`,
      io: req.io,
    });

    // Log activity for the admin
    await logActivity({
      userID: req.user.userID,
      action: "block_user",
      description: `You blocked user ${user.name}.`,
      io: req.io,
    });

    // Notify user's friends
    const friends = await prisma.friends.findMany({
      where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] },
    });

    for (const friend of friends) {
      await logActivity({
        userID: friend.userID === parseInt(userId)
          ? parseInt(friend.friendID)
          : parseInt(friend.userID),
        action: "friend_blocked",
        description: `${user.name} has been blocked.`,
        io: req.io,
      });
    }

    // Send email to the user
    const subject = "Account Blocked on FinestShare";
    const htmlContent = `
      <p>Dear ${user.name},</p>
      <p>Your account has been temporarily blocked. Please contact support for more details.</p>
      <p>Support Email: finestshare@gmail.com</p>
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

    // Log activity for the unblocked user
    await logActivity({
      userID: user.userID,
      action: "account_unblocked",
      description: `Your account has been unblocked.`,
      io: req.io,
    });

    // Log activity for the admin
    await logActivity({
      userID: req.userID,
      action: "unblock_user",
      description: `You unblocked user ${user.name}.`,
      io: req.io,
    });

    // Notify user's friends
    const friends = await prisma.friends.findMany({
      where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] },
    });

    for (const friend of friends) {
      await logActivity({
        userID: friend.userID === parseInt(userId)
          ? parseInt(friend.friendID)
          : parseInt(friend.userID),
        action: "friend_unblocked",
        description: `${user.name} has been unblocked.`,
        io: req.io,
      });
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
    const user = await prisma.user.findUnique({
      where: { userID: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role == 'ADMIN') {
      return res.status(403).json({ error: "You can't delete another admin" });
    }

    // Delete the user and related data
    await prisma.$transaction([
      prisma.friends.deleteMany({ where: { OR: [{ userID: parseInt(userId) }, { friendID: parseInt(userId) }] } }),
      prisma.groupMember.deleteMany({ where: { userID: parseInt(userId) } }),
      prisma.activities.deleteMany({ where: { userID: parseInt(userId) } }),
      prisma.group.deleteMany({ where: { createdBy: parseInt(userId) } }),
      prisma.user.delete({ where: { userID: parseInt(userId) } }),
    ]);

    // Log activity for the admin
    await logActivity({
      userID: req.user.userID,
      action: "delete_user",
      description: `You deleted user ${user.name}.`,
      io: req.io,
    });

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

    // Log activity for the promoted user
    await logActivity({
      userID: user.userID,
      action: "promoted_to_admin",
      description: `Congratulations! You have been promoted to an admin role.`,
      io: req.io,
    });

    // Log activity for the admin
    await logActivity({
      userID: req.user.userID,
      action: "promote_user",
      description: `You promoted user ${user.name} to admin.`,
      io: req.io,
    });

    res.status(200).json({ message: `User ${user.name} promoted to admin` });
  } catch (error) {
    console.error(error);
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
