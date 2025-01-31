const { Server } = require("socket.io");
const { getUnreadActivities } = require("../utils/notifications");
const prisma = require("./prismaClient");
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'jwt';

let io;

function setupWebSocket(server) {
    io = new Server(server, {
    cors: { origin: "*" },
  });

  // Keep track of online users
  io.onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Authenticate and register the user
    socket.on("authenticate", async (data) => {
      // Decode and verify the JWT token
      const decoded = jwt.verify(data.token,JWT_SECRET);
      const userID = decoded.id;
      if (!userID) {
        console.error("Invalid token: userID not found.");
        socket.emit("error", { message: "Invalid token" });
        return;
      }

      io.onlineUsers.set(userID, socket.id);
      console.log(`User ${userID} authenticated and connected.`);

      // Send unread notifications to the user
      try {
        const unreadActivities = await getUnreadActivities(userID);

        unreadActivities.forEach((activity) => {
          socket.emit("notification", {
            activityID: activity.activityID,
            action: activity.action,
            description: activity.description,
            timestamp: activity.timestamp,
            isRead: false,
          });
        });
      } catch (err) {
        console.error("Error fetching unread activities:", err);
      }
    });

    // Mark activity as read
    socket.on("markAsRead", async ({ activityID }) => {
      try {
        await prisma.activities.update({
          where: { activityID },
          data: { isRead: true },
        });
        console.log(`Activity ${activityID} marked as read.`);
      } catch (err) {
        console.error("Error marking activity as read:", err);
      }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      const userID = Array.from(io.onlineUsers.entries()).find(
        ([, socketId]) => socketId === socket.id
      )?.[0];
      if (userID) io.onlineUsers.delete(userID);
      console.log(`User ${userID} disconnected.`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
}

module.exports =  { setupWebSocket, getIO };