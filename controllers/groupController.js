const prisma = require('../config/prismaClient');
const { v4: uuidv4 } = require('uuid');
const { sendGroupInvitationMail} = require('../utils/mailer');
const { logActivity } = require("../utils/notifications");

// Create a new group
exports.createGroup = async (req, res) => {
  const { groupName, groupType, groupImage, members } = req.body;

  if (!groupName || !groupType || !members || members.length === 0) {
    return res.status(400).json({ message: 'Group name, type, and members are required' });
  }

  try {
    const defaultGroupImage = "https://s3.amazonaws.com/splitwise/uploads/group/default_avatars/v2021/avatar-blue4-trip-50px.png";

    // Create the group
    const newGroup = await prisma.group.create({
      data: {
        groupName,
        groupType,
        groupImage: groupImage || defaultGroupImage,
        createdBy: req.userID,
      },
    });

     // Add the creator as a member
     await prisma.groupMember.create({
      data: {
        groupID: newGroup.groupID,
        userID: req.userID,
      },
    });

     // Log activity for group creation
    await logActivity({
      userID: req.userID,
      action: "created_group",
      description: `You created the group "${groupName}`,
      io: req.io,
    });

    // Process and add members
    for (const member of members) {
      let user = null;
      let emailnotify=true;

      // Check if email exists
      if (member.email) {
        user = await prisma.user.findUnique({ where: { email: member.email } });

        if (user && user.userID === req.userID) {
          return res.status(400).json({ message: `Skipping adding the creator (${member.email}) as a member again.` });
        }
      } else {
        emailnotify=false;
        member.email = `unknown-${uuidv4()}@example.com`;
      }

      // If user doesn't exist, create them
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: member.name || `User-${uuidv4()}`,
            password:'nopassword',
            email: member.email,
            role: 'user',
          },
        });

        if(emailnotify)
        {
          await sendGroupInvitationMail(member.email, groupName);
        }
      }

      // Check if the friend relationship already exists
      const existingFriend = await prisma.friends.findFirst({
        where: {
          userID: req.userID,
          friendID: user.userID,
        },
      });

      if (!existingFriend) {
        // Add as friend
        await prisma.friends.createMany({
          data: [
            { userID: req.userID, friendID: user.userID },
            { userID: user.userID, friendID: req.userID },
          ],
        });
      }

      // Add user to the group
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          groupID: newGroup.groupID,
          userID: user.userID,
        },
      });

      if (!existingMember) {
        await prisma.groupMember.create({
          data: {
            groupID: newGroup.groupID,
            userID: user.userID,
          },
        });

        // Log activity for adding a member
        await logActivity({
          userID: user.userID,
          action: "added_to_group",
          description: `You were added to the group "${groupName}" by ${req.user.name}`,
          io: req.io,
        });


      } else {
        console.log(`User ${member.email} is already part of the group.`);
      }
    }

    res.status(201).json({ message: 'Group created successfully', group: newGroup });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

exports.editGroup = async (req, res) => {
  const { groupID } = req.params;
  const { groupName, groupType, groupImage, members } = req.body;

  try {
    const group = await prisma.group.findUnique({ where: { groupID: parseInt(groupID) } });

    if (!group || group.createdBy !== req.userID) {
      return res.status(403).json({ message: 'You are not authorized to edit this group' });
    }

    await prisma.group.update({
      where: { groupID: parseInt(groupID) },
      data: { groupName, groupType, groupImage: groupImage || group.groupImage },
    });

    if (members) {
      await prisma.groupMember.deleteMany({ where: { groupID: parseInt(groupID) } });

      for (const member of members) {
        let user = null;
        let emailnotify = true;

        if (member.email) {
          user = await prisma.user.findUnique({ where: { email: member.email } });
        } else {
          emailnotify = false;
          member.email = `unknown-${uuidv4()}@example.com`;
        }

        if (!user) {
          user = await prisma.user.create({
            data: {
              name: member.name || `User-${uuidv4()}`,
              password: 'nopassword',
              email: member.email,
              role: 'user',
            },
          });

          // Log activity for adding a member
          await logActivity({
            userID: user.userID,
            action: "added_to_group",
            description: `You were added to the group "${groupName}" by ${req.user.name}`,
            io: req.io,
          });

          if (emailnotify) {
            await sendGroupInvitationMail(member.email, groupName);
          }
        }

        if (user.email.startsWith('unknown-') && member.newEmail) {
          const emailExists = await prisma.user.findUnique({ where: { email: member.newEmail } });

          if (emailExists) {
            return res.status(400).json({ 
              message: `The email address ${member.newEmail} is already associated with another user.` 
            });
          }

          await prisma.user.update({
            where: { email: user.email },
            data: { email: member.newEmail },
          });

          await sendGroupInvitationMail(member.newEmail, groupName);
        }

        const existingFriend = await prisma.friends.findFirst({
          where: { userID: req.userID, friendID: user.userID },
        });

        if (!existingFriend) {
          await prisma.friends.createMany({
            data: [
              { userID: req.userID, friendID: user.userID },
              { userID: user.userID, friendID: req.userID },
            ],
          });
        }

        await prisma.groupMember.create({
          data: { groupID: parseInt(groupID), userID: user.userID },
        });
      }
    }

    res.status(200).json({ message: 'Group updated successfully' });
  } catch (error) {
    console.error('Error editing group:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
};


// Delete a group
exports.deleteGroup = async (req, res) => {
  const { groupID } = req.params;

  try {
    const group = await prisma.group.findUnique({ where: { groupID: parseInt(groupID) } });

    if (!group || group.createdBy !== req.userID) {
      return res.status(403).json({ message: 'You are not authorized to delete this group' });
    }

    const pendingExpenses = await prisma.expenses.findMany({
      where: { groupID: parseInt(groupID) },
    });

    if (pendingExpenses.length > 0) {
      return res.status(400).json({ message: 'Cannot delete group with pending expenses' });
    }

    await prisma.group.delete({ where: { groupID: parseInt(groupID) } });

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
};

exports.viewGroupDetails = async (req, res) => {
  const { groupID } = req.params;

  try {
    const group = await prisma.group.findUnique({
      where: { groupID: parseInt(groupID) },
      include: {
        members: {
          include: {
            user: {
              select: {
                userID: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the user is authorized to view the group
    const isMember = group.members.some(member => member.user.userID === req.userID);

    if (!isMember && group.createdBy !== req.userID) {
      return res.status(403).json({ message: 'You are not authorized to view this group' });
    }

    const creator=await prisma.user.findUnique({
      where:{userID:parseInt(group.createdBy)},
      select:{
        name:true,
      }
    })

    // Restructure the members to include only the user details
    const groupWithFilteredMembers = {
      ...group,
      createdByName:creator.name,
      members: group.members.map(member => member.user),
    };

    res.status(200).json({ group: groupWithFilteredMembers });
  } catch (error) {
    console.error('Error viewing group details:', error);
    res.status(500).json({ message: 'Failed to fetch group details' });
  }
};


// View all groups related to the user with pagination
exports.viewUserGroups = async (req, res) => {
  try {
    // Extract page and limit from query parameters 
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 10; 
    const skip = (page - 1) * limit; 

    const totalGroups = await prisma.group.count({
      where: {
        OR: [
          { createdBy: req.userID },
          {
            members: {
              some: {
                userID: req.userID,
              },
            },
          },
        ],
      },
    });

    const userGroups = await prisma.group.findMany({
      where: {
        OR: [
          { createdBy: req.userID },
          {
            members: {
              some: {
                userID: req.userID,
              },
            },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                userID: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      skip: skip, 
      take: limit, 
    });

    res.status(200).json({
      groups: userGroups,
      currentPage: page,
      totalGroups,
      totalPages: Math.ceil(totalGroups / limit),
    });
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ message: "Failed to fetch groups" });
  }
};
