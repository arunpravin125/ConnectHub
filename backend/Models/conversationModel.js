import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Type: "direct" for 1:1 chats, "group" for group chats
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },

    // Group-specific fields (only used when type === "group")
    name: {
      type: String,
      default: null, // null for direct chats
    },
    description: {
      type: String,
      default: null, // optional group description
      maxLength: 500,
    },
    iconUrl: {
      type: String,
      default: null, // optional group icon
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for direct chats
    },

    // Members array for group chats (with roles)
    // For direct chats, this will be empty and we use participants
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Participants array (kept for backward compatibility with direct chats)
    // For direct chats: [user1, user2]
    // For group chats: derived from members array (for compatibility)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastMessage: {
      text: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      seen: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

// Index for fast member lookups in group chats
conversationSchema.index({ "members.userId": 1 });
// Index for participants (works for both direct and group)
conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
