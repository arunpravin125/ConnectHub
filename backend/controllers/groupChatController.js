import Conversation from "../Models/conversationModel.js";
import Message from "../Models/messageModel.js";
import User from "../Models/userModel.js";
import { getRecipiantSocketId, io } from "../socket/socket.js";

// Helper: Create system message for group events
const createSystemMessage = async (conversationId, text) => {
  const systemMessage = new Message({
    conversationId,
    sender: null, // System message has no sender
    text: `🔔 ${text}`,
    seen: false,
  });
  await systemMessage.save();
  return systemMessage;
};

// Helper: Emit to all group members
const emitToGroupMembers = async (conversation, event, data) => {
  const memberIds = conversation.members.map((m) => m.userId.toString());
  memberIds.forEach((memberId) => {
    const socketId = getRecipiantSocketId(memberId);
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  });
};

// Helper: Get user display name
const getUserDisplayName = (user) => {
  return user.name || user.username || "Unknown";
};

// 1. Create Group
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds, iconUrl } = req.body;
    const creatorId = req.user._id;

    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    if (description && description.length > 500) {
      return res
        .status(400)
        .json({ error: "Description must be 500 characters or less" });
    }

    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({
        error: "At least 2 members are required (excluding creator)",
      });
    }

    // Remove duplicates and creator from memberIds
    const uniqueMemberIds = [...new Set(memberIds)].filter(
      (id) => id.toString() !== creatorId.toString()
    );

    if (uniqueMemberIds.length < 2) {
      return res.status(400).json({
        error: "At least 2 unique members are required (excluding creator)",
      });
    }

    // Verify all member IDs exist
    const members = await User.find({
      _id: { $in: uniqueMemberIds },
    }).select("_id username name");

    if (members.length !== uniqueMemberIds.length) {
      return res
        .status(400)
        .json({ error: "One or more member IDs are invalid" });
    }

    // Create members array with creator as admin
    const allMembers = [
      {
        userId: creatorId,
        role: "admin",
        joinedAt: new Date(),
      },
      ...uniqueMemberIds.map((memberId) => ({
        userId: memberId,
        role: "member",
        joinedAt: new Date(),
      })),
    ];

    // Create conversation
    const conversation = new Conversation({
      type: "group",
      name: name.trim(),
      description: description ? description.trim() : null,
      iconUrl: iconUrl || null,
      createdBy: creatorId,
      members: allMembers,
      participants: [creatorId, ...uniqueMemberIds], // For compatibility
      lastMessage: {
        text: "",
        sender: null,
        seen: false,
      },
    });

    await conversation.save();

    // Create system message
    const creator = await User.findById(creatorId).select("username name");
    const memberNames = members.map((m) => getUserDisplayName(m)).join(", ");
    const systemText = `${getUserDisplayName(creator)} created the group${
      memberNames ? ` and added ${memberNames}` : ""
    }`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    // Update last message
    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate conversation for response
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    // Emit to all members
    await emitToGroupMembers(populatedConversation, "group:created", {
      conversation: populatedConversation,
    });

    // Emit new message to all members
    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    res.status(201).json(populatedConversation);
  } catch (error) {
    console.error("Error in createGroup:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// 2. Add Members (admin only)
export const addMembers = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ error: "Not a group chat" });
    }

    // Check if user is admin
    const userMember = conversation.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "memberIds array is required" });
    }

    // Get existing member IDs
    const existingMemberIds = conversation.members.map((m) =>
      m.userId.toString()
    );

    // Filter out already-existing members
    const newMemberIds = [...new Set(memberIds)].filter(
      (id) => !existingMemberIds.includes(id.toString())
    );

    if (newMemberIds.length === 0) {
      return res.status(400).json({ error: "All users are already members" });
    }

    // Verify new members exist
    const newMembers = await User.find({
      _id: { $in: newMemberIds },
    }).select("_id username name");

    if (newMembers.length !== newMemberIds.length) {
      return res
        .status(400)
        .json({ error: "One or more member IDs are invalid" });
    }

    // Add new members
    const membersToAdd = newMemberIds.map((memberId) => ({
      userId: memberId,
      role: "member",
      joinedAt: new Date(),
    }));

    conversation.members.push(...membersToAdd);
    conversation.participants.push(...newMemberIds); // For compatibility
    await conversation.save();

    // Create system message
    const actor = await User.findById(userId).select("username name");
    const memberNames = newMembers.map((m) => getUserDisplayName(m)).join(", ");
    const systemText = `${getUserDisplayName(actor)} added ${memberNames}`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate and emit
    const populatedConversation = await Conversation.findById(chatId)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    await emitToGroupMembers(populatedConversation, "group:members_changed", {
      conversation: populatedConversation,
      action: "added",
      memberIds: newMemberIds,
    });

    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    res.status(200).json(populatedConversation);
  } catch (error) {
    console.error("Error in addMembers:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// 3. Remove Member (admin only)
export const removeMember = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ error: "Not a group chat" });
    }

    // Check if user is admin
    const userMember = conversation.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    // Find member to remove
    const memberToRemove = conversation.members.find(
      (m) => m.userId.toString() === memberId.toString()
    );

    if (!memberToRemove) {
      return res.status(404).json({ error: "Member not found in group" });
    }

    // Cannot remove the last admin
    const adminCount = conversation.members.filter(
      (m) => m.role === "admin"
    ).length;
    if (memberToRemove.role === "admin" && adminCount === 1) {
      return res.status(400).json({
        error: "Cannot remove the last admin. Promote another member first.",
      });
    }

    // Remove from members and participants
    conversation.members = conversation.members.filter(
      (m) => m.userId.toString() !== memberId.toString()
    );
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== memberId.toString()
    );
    await conversation.save();

    // Create system message
    const actor = await User.findById(userId).select("username name");
    const removedUser = await User.findById(memberId).select("username name");
    const systemText = `${getUserDisplayName(
      actor
    )} removed ${getUserDisplayName(removedUser)}`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate and emit
    const populatedConversation = await Conversation.findById(chatId)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    // Emit to remaining members
    await emitToGroupMembers(populatedConversation, "group:members_changed", {
      conversation: populatedConversation,
      action: "removed",
      memberId,
    });

    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    // Also emit to removed user (if they're still connected)
    const removedUserSocketId = getRecipiantSocketId(memberId);
    if (removedUserSocketId) {
      io.to(removedUserSocketId).emit("group:removed", {
        conversationId: chatId,
      });
    }

    res.status(200).json(populatedConversation);
  } catch (error) {
    console.error("Error in removeMember:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// 4. Promote/Demote (admin only)
export const updateMemberRole = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user._id;

    if (!role || !["admin", "member"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Invalid role. Must be 'admin' or 'member'" });
    }

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ error: "Not a group chat" });
    }

    // Check if user is admin
    const userMember = conversation.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!userMember || userMember.role !== "admin") {
      return res.status(403).json({ error: "Only admins can change roles" });
    }

    // Find member to update
    const memberToUpdate = conversation.members.find(
      (m) => m.userId.toString() === memberId.toString()
    );

    if (!memberToUpdate) {
      return res.status(404).json({ error: "Member not found in group" });
    }

    // Cannot demote the last admin
    if (memberToUpdate.role === "admin" && role === "member") {
      const adminCount = conversation.members.filter(
        (m) => m.role === "admin"
      ).length;
      if (adminCount === 1) {
        return res.status(400).json({
          error: "Cannot demote the last admin",
        });
      }
    }

    // Update role
    memberToUpdate.role = role;
    await conversation.save();

    // Create system message
    const actor = await User.findById(userId).select("username name");
    const targetUser = await User.findById(memberId).select("username name");
    const systemText =
      role === "admin"
        ? `${getUserDisplayName(actor)} made ${getUserDisplayName(
            targetUser
          )} an admin`
        : `${getUserDisplayName(actor)} removed ${getUserDisplayName(
            targetUser
          )} as admin`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate and emit
    const populatedConversation = await Conversation.findById(chatId)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    await emitToGroupMembers(populatedConversation, "group:members_changed", {
      conversation: populatedConversation,
      action: "role_changed",
      memberId,
      newRole: role,
    });

    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    res.status(200).json(populatedConversation);
  } catch (error) {
    console.error("Error in updateMemberRole:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// 5. Leave Group
export const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ error: "Not a group chat" });
    }

    // Find user in members
    const userMember = conversation.members.find(
      (m) => m.userId.toString() === userId.toString()
    );

    if (!userMember) {
      return res
        .status(404)
        .json({ error: "You are not a member of this group" });
    }

    // If last admin, auto-promote oldest member (WhatsApp-like)
    if (userMember.role === "admin") {
      const adminCount = conversation.members.filter(
        (m) => m.role === "admin"
      ).length;
      if (adminCount === 1) {
        // Find oldest member (excluding the leaving admin)
        const remainingMembers = conversation.members.filter(
          (m) => m.userId.toString() !== userId.toString()
        );
        if (remainingMembers.length > 0) {
          // Sort by joinedAt and promote the oldest
          remainingMembers.sort(
            (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
          );
          remainingMembers[0].role = "admin";
        }
      }
    }

    // Remove from members and participants
    conversation.members = conversation.members.filter(
      (m) => m.userId.toString() !== userId.toString()
    );
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== userId.toString()
    );
    await conversation.save();

    // Create system message
    const leavingUser = await User.findById(userId).select("username name");
    const systemText = `${getUserDisplayName(leavingUser)} left`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate and emit to remaining members
    const populatedConversation = await Conversation.findById(chatId)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    await emitToGroupMembers(populatedConversation, "group:members_changed", {
      conversation: populatedConversation,
      action: "left",
      memberId: userId,
    });

    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    // Emit to leaving user
    const leavingUserSocketId = getRecipiantSocketId(userId);
    if (leavingUserSocketId) {
      io.to(leavingUserSocketId).emit("group:left", {
        conversationId: chatId,
      });
    }

    res.status(200).json({ success: true, message: "Left group successfully" });
  } catch (error) {
    console.error("Error in leaveGroup:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// 6. Update Group Info (name/description/icon) - admin only
export const updateGroupInfo = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name, description, iconUrl } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findById(chatId);
    if (!conversation) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ error: "Not a group chat" });
    }

    // Check if user is admin
    const userMember = conversation.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!userMember || userMember.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only admins can update group info" });
    }

    // Update fields
    if (name !== undefined) {
      if (name.trim() === "") {
        return res.status(400).json({ error: "Group name cannot be empty" });
      }
      conversation.name = name.trim();
    }
    if (description !== undefined) {
      if (description && description.length > 500) {
        return res
          .status(400)
          .json({ error: "Description must be 500 characters or less" });
      }
      conversation.description = description ? description.trim() : null;
    }
    if (iconUrl !== undefined) {
      conversation.iconUrl = iconUrl || null;
    }

    await conversation.save();

    // Create system message
    const actor = await User.findById(userId).select("username name");
    const changes = [];
    if (name !== undefined) changes.push(`name to "${conversation.name}"`);
    if (description !== undefined) changes.push("description");
    if (iconUrl !== undefined) changes.push("icon");
    const systemText = `${getUserDisplayName(
      actor
    )} changed the group ${changes.join(" and ")}`;
    const systemMessage = await createSystemMessage(
      conversation._id,
      systemText
    );

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: null,
      seen: false,
    };
    await conversation.save();

    // Populate and emit
    const populatedConversation = await Conversation.findById(chatId)
      .populate("members.userId", "username name profilePic")
      .populate("createdBy", "username name profilePic")
      .populate("participants", "username name profilePic");

    await emitToGroupMembers(populatedConversation, "group:updated", {
      conversation: populatedConversation,
    });

    await emitToGroupMembers(
      populatedConversation,
      "newMessage",
      systemMessage
    );

    res.status(200).json(populatedConversation);
  } catch (error) {
    console.error("Error in updateGroupInfo:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};
