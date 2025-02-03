const prisma = require("../config/prismaClient");

async function logActivity({ userID, action, description, io }) {
  try {
    // Log the activity in the database
    const activity = await prisma.activities.create({
      data: {
        userID,
        action,
        description,
      },
    });

    // Emit a notification via WebSocket
    if (io) {
      const socketID = io.onlineUsers.get(userID);
      if (socketID) {
        io.to(socketID).emit("notification", {
          activityID: activity.activityID,
          action: activity.action,
          description: activity.description,
          timestamp: activity.timestamp,
          isRead: activity.isRead,
        });
      }
    }

    return activity;
  } catch (err) {
    console.error("Error logging activity:", err);
    throw new Error("Failed to log activity");
  }
}

async function getUnreadActivities(userID) {
  try {
    const unreadActivities = await prisma.activities.findMany({
      where: { userID, isRead: false },
    });

    // Mark all unread activities as read
    if (unreadActivities.length > 0) {
      //findMany
      await prisma.activities.updateMany({ 
        where: { userID, isRead: false },
        data: { isRead: true },
      });
    }

    return unreadActivities;
  } catch (err) {
    console.error("Error fetching unread activities:", err);
    throw new Error("Failed to fetch unread activities");
  }
}

module.exports = { logActivity, getUnreadActivities };
