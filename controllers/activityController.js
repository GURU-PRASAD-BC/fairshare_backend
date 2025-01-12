const prisma = require("../config/prismaClient");

// Get recent activities for a user
exports.getUserActivities = async (req, res) => {
  const userID = req.user.userID; // Assuming `req.user` contains the authenticated user

  try {
    const activities = await prisma.activities.findMany({
      where: { userID },
      orderBy: { timestamp: "desc" },
      take: 20, // Limit to the last 20 activities
    });

    res.status(200).json({ activities });
  } catch (error) {
    console.error("Error fetching user activities:", error);
    res.status(500).json({ message: "Failed to fetch activities" });
  }
};

// Log a new activity
exports.logActivity = async (req, res) => {
  const { userID, action, description } = req.body;

  if (!userID || !action || !description) {
    return res.status(400).json({ message: "userID, action, and description are required" });
  }

  try {
    const newActivity = await prisma.activities.create({
      data: {
        userID,
        action,
        description,
      },
    });

    res.status(201).json({ message: "Activity logged successfully", activity: newActivity });
  } catch (error) {
    console.error("Error logging activity:", error);
    res.status(500).json({ message: "Failed to log activity" });
  }
};
