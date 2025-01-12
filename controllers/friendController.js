const prisma = require("../config/prismaClient");
const { sendFriendInvitationMail } = require("../utils/mailer");

// Add a friend by email
const addFriend = async (req, res) => {
    const { friendEmail } = req.body; 
    const userID = req.user.userID; 
  
    if (!friendEmail) {
      return res.status(400).json({ message: "Friend's email is required" });
    }
  
    try {
      const friend = await prisma.user.findUnique({
        where: { email: friendEmail },
      });
  
      if (friend) {
        const friendID = friend.userID;
  
        const existingFriendship = await prisma.friends.findFirst({
          where: { userID, friendID },
        });
  
        if (existingFriendship) {
          return res.status(400).json({ message: "You are Already Friends!" });
        }
  
        // Create mutual friendship entries
        await prisma.friends.createMany({
          data: [
            { userID, friendID },
            { userID: friendID, friendID: userID },
          ],
        });
  
        return res.status(201).json({ message: "Friend added successfully!" });
      } else {
        // If the user does not exist, send an invitation email
        await sendFriendInvitationMail(friendEmail, "Splitwise Group");
        return res.status(200).json({ message: "Invitation email sent successfully!" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to add friend." });
    }
  };
  
  module.exports = { addFriend };
  

// Get friends list
const getFriends = async (req, res) => {
  const userID = req.user.userID; 

  try {
    const friends = await prisma.friends.findMany({
      where: { userID },
      include: {
        friend: {
          select: { userID: true, name: true, email: true, image: true },
        },
      },
    });

    const friendsList = friends.map((f) => f.friend);

    res.status(200).json(friendsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch friends list." });
  }
};

// Remove a friend
const removeFriend = async (req, res) => {
  const { friendID } = req.params;
  const userID = req.user.userID; 

  try {
    // Delete mutual friendship entries
    await prisma.friends.deleteMany({
      where: {
        OR: [
          { userID, friendID: parseInt(friendID) },
          { userID: parseInt(friendID), friendID: userID },
        ],
      },
    });

    res.status(200).json({ message: "Friend removed successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to remove friend." });
  }
};

module.exports = { addFriend, getFriends, removeFriend };
