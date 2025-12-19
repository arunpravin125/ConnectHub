import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../Models/messageModel.js";
import Conversation from "../Models/conversationModel.js";
import Space from "../Models/spaceModel.js";
import Recording from "../Models/recordingModel.js";

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO - support both development and production
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3005",
  "http://192.168.43.223:3005/",
  "http://172.20.208.1:3005/",
  "http://localhost:5173", // Vite default port
  "https://connecthub-oddy.onrender.com",
  "https://connecthub-15.onrender.com",
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove undefined values

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins
      if (process.env.NODE_ENV !== "production") {
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          return callback(null, true);
        }
      }

      // Check against allowed origins
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"], // Explicitly allow both transports
  allowEIO3: true, // Allow Engine.IO v3 clients
});

export const getRecipiantSocketId = (recipientId) => {
  return userSocketMap[recipientId];
};

const userSocketMap = {}; //userId :socketId

io.on("connection", (socket) => {
  const userId = socket?.handshake.query.userId;

  console.log("🔌 New socket connection:", {
    socketId: socket.id,
    userId: userId,
    connected: socket.connected,
  });

  if (userId && userId !== "undefined" && userId !== "null") {
    userSocketMap[userId] = socket.id;
    console.log(`✅ User ${userId} mapped to socket ${socket.id}`);
  } else {
    console.warn("⚠️ Socket connected without valid userId");
  }
  socket?.on("Like", async ({ postId, authId }) => {
    io.emit("newLike", { postId, authId });
  });

  socket?.on("comment", ({ newComment, postId }) => {
    io.emit("new-comment", { newComment, postId });
  });
  socket?.on("livePost", ({ livePost }) => {
    console.log("Post", livePost);
    io.emit("postLive", { livePost });
  });

  // Legacy typing handler (keep for backward compatibility if needed)
  socket?.on("typing", ({ typing, userId, conversationId }) => {
    console.log("typing event received:", { typing, userId, conversationId });
    const recipientSocketId = userSocketMap[userId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("currentTyping", { typing });
      io.to(recipientSocketId).emit("currentUserId", { conversationId });
      console.log(
        `✅ Typing indicator sent to recipient ${userId} (socket: ${recipientSocketId})`
      );
    } else {
      console.warn(`⚠️ Recipient ${userId} not found in socket map`);
    }
  });

  // WhatsApp-style typing indicator with rooms
  // In-memory map to track typing state: chatId -> userId -> lastTypingAt
  const typingState = new Map(); // Map<chatId, Map<userId, timestamp>>

  // Join chat room when user opens a conversation
  socket.on("chat:join", async ({ chatId }) => {
    if (!userId || !chatId) return;

    try {
      // Verify user is a participant in this conversation
      const conversation = await Conversation.findById(chatId);
      if (!conversation) {
        console.warn(`⚠️ Conversation ${chatId} not found`);
        return;
      }

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === userId.toString()
      );
      if (!isParticipant) {
        console.warn(
          `⚠️ User ${userId} is not a participant in chat ${chatId}`
        );
        return;
      }

      socket.join(`chat:${chatId}`);
      console.log(`✅ User ${userId} joined chat room: chat:${chatId}`);
    } catch (error) {
      console.error("Error joining chat room:", error);
    }
  });

  // Leave chat room
  socket.on("chat:leave", ({ chatId }) => {
    if (!chatId) return;
    socket.leave(`chat:${chatId}`);
    // Clear typing state for this user in this chat
    if (typingState.has(chatId)) {
      typingState.get(chatId).delete(userId);
      if (typingState.get(chatId).size === 0) {
        typingState.delete(chatId);
      }
    }
    // Emit typing stop to room
    socket.to(`chat:${chatId}`).emit("chat:typing", {
      chatId,
      userId,
      isTyping: false,
    });
    console.log(`✅ User ${userId} left chat room: chat:${chatId}`);
  });

  // Typing start event
  socket.on("chat:typing_start", async ({ chatId }) => {
    if (!userId || !chatId) return;

    try {
      // Verify user is a participant
      const conversation = await Conversation.findById(chatId);
      if (!conversation) return;

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === userId.toString()
      );
      if (!isParticipant) return;

      // Update typing state
      if (!typingState.has(chatId)) {
        typingState.set(chatId, new Map());
      }
      typingState.get(chatId).set(userId, Date.now());

      // Emit to other participants in the room (exclude sender)
      socket.to(`chat:${chatId}`).emit("chat:typing", {
        chatId,
        userId,
        isTyping: true,
      });

      console.log(`📝 User ${userId} started typing in chat ${chatId}`);
    } catch (error) {
      console.error("Error in chat:typing_start:", error);
    }
  });

  // Typing stop event
  socket.on("chat:typing_stop", async ({ chatId }) => {
    if (!userId || !chatId) return;

    try {
      // Verify user is a participant
      const conversation = await Conversation.findById(chatId);
      if (!conversation) return;

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === userId.toString()
      );
      if (!isParticipant) return;

      // Clear typing state
      if (typingState.has(chatId)) {
        typingState.get(chatId).delete(userId);
        if (typingState.get(chatId).size === 0) {
          typingState.delete(chatId);
        }
      }

      // Emit to other participants in the room (exclude sender)
      socket.to(`chat:${chatId}`).emit("chat:typing", {
        chatId,
        userId,
        isTyping: false,
      });

      console.log(`🛑 User ${userId} stopped typing in chat ${chatId}`);
    } catch (error) {
      console.error("Error in chat:typing_stop:", error);
    }
  });

  // Auto-expire typing state after 5 seconds (disconnect edge cases)
  setInterval(() => {
    const now = Date.now();
    const expireTime = 5000; // 5 seconds

    typingState.forEach((userMap, chatId) => {
      userMap.forEach((lastTypingAt, userId) => {
        if (now - lastTypingAt > expireTime) {
          userMap.delete(userId);
          // Emit typing stop
          io.to(`chat:${chatId}`).emit("chat:typing", {
            chatId,
            userId,
            isTyping: false,
          });
          console.log(
            `⏱️ Auto-expired typing state for user ${userId} in chat ${chatId}`
          );
        }
      });
      if (userMap.size === 0) {
        typingState.delete(chatId);
      }
    });
  }, 2000); // Check every 2 seconds

  socket?.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
    try {
      await Message.updateMany(
        { conversationId: conversationId, seen: false },
        { $set: { seen: true } }
      );
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { "lastMessage.seen": true } }
      );
      io.to(userSocketMap[userId]).emit("messagesSeen", { conversationId });
    } catch (error) {
      console.log("error in mark:", error.message);
    }
  });

  // Space recording events (host only)
  socket.on("space:recordStart", async ({ spaceId }) => {
    try {
      if (!userId || userId === "undefined") {
        socket.emit("space:error", { error: "Unauthorized" });
        return;
      }

      const space = await Space.findById(spaceId);
      if (!space) {
        socket.emit("space:error", { error: "Space not found" });
        return;
      }

      // Verify user is host
      if (space.hostId.toString() !== userId.toString()) {
        socket.emit("space:error", {
          error: "Only the space host can start recording",
        });
        return;
      }

      // Check if already recording
      if (space.isRecording) {
        socket.emit("space:error", {
          error: "Recording already in progress",
        });
        return;
      }

      // Validate space is live
      if (space.status !== "live") {
        socket.emit("space:error", {
          error: "Can only record when space is live",
        });
        return;
      }

      // Create recording record
      const recording = new Recording({
        spaceId: space._id,
        hostId: userId,
        status: "recording",
        startedAt: new Date(),
      });
      await recording.save();

      // Update space
      space.isRecording = true;
      space.activeRecordingId = recording._id;
      await space.save();

      // Emit to all space participants
      io.emit("space:recordingStatus", {
        spaceId: space._id,
        isRecording: true,
        recordingId: recording._id,
      });
    } catch (error) {
      console.error("Error in space:recordStart:", error);
      socket.emit("space:error", { error: error.message });
    }
  });

  socket.on("space:recordStop", async ({ spaceId }) => {
    try {
      if (!userId || userId === "undefined") {
        socket.emit("space:error", { error: "Unauthorized" });
        return;
      }

      const space = await Space.findById(spaceId);
      if (!space) {
        socket.emit("space:error", { error: "Space not found" });
        return;
      }

      // Verify user is host
      if (space.hostId.toString() !== userId.toString()) {
        socket.emit("space:error", {
          error: "Only the space host can stop recording",
        });
        return;
      }

      if (!space.isRecording || !space.activeRecordingId) {
        socket.emit("space:error", {
          error: "No active recording to stop",
        });
        return;
      }

      const recording = await Recording.findById(space.activeRecordingId);
      if (recording) {
        recording.status = "processing";
        recording.endedAt = new Date();
        await recording.save();
      }

      // Update space
      space.isRecording = false;
      const recordingId = space.activeRecordingId;
      space.activeRecordingId = null;
      await space.save();

      // Emit to all space participants
      io.emit("space:recordingStatus", {
        spaceId: space._id,
        isRecording: false,
        recordingId: recordingId,
      });
    } catch (error) {
      console.error("Error in space:recordStop:", error);
      socket.emit("space:error", { error: error.message });
    }
  });

  // Join space room for real-time updates
  socket.on("space:join", ({ spaceId }) => {
    socket.join(`space:${spaceId}`);
    console.log(`User ${userId} joined space ${spaceId}`);
  });

  socket.on("space:leave", ({ spaceId }) => {
    socket.leave(`space:${spaceId}`);
    console.log(`User ${userId} left space ${spaceId}`);
  });

  // ========== WebRTC Signaling for Audio Spaces ==========
  // WebRTC offer (SDP offer from peer)
  socket.on(
    "space:webrtc:offer",
    async ({ spaceId, targetUserId, offer, fromUserId }) => {
      if (!userId || !spaceId || !targetUserId || !offer) {
        console.error("Invalid WebRTC offer parameters");
        return;
      }

      // Verify sender is participant in space
      try {
        const Space = (await import("../Models/spaceModel.js")).default;
        const space = await Space.findById(spaceId);
        if (!space) {
          console.error(`Space ${spaceId} not found`);
          return;
        }

        const isParticipant =
          space.hostId.toString() === userId.toString() ||
          space.speakers.some((s) => s.toString() === userId.toString()) ||
          space.listeners.some((l) => l.toString() === userId.toString());

        if (!isParticipant) {
          console.error(
            `User ${userId} is not a participant in space ${spaceId}`
          );
          return;
        }

        // Relay offer to target user in the space room
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("space:webrtc:offer", {
            spaceId,
            fromUserId: userId,
            offer,
          });
          console.log(
            `📤 WebRTC offer relayed: ${userId} → ${targetUserId} in space ${spaceId}`
          );
        } else {
          console.warn(`⚠️ Target user ${targetUserId} not connected`);
        }
      } catch (error) {
        console.error("Error in space:webrtc:offer:", error);
      }
    }
  );

  // WebRTC answer (SDP answer from peer)
  socket.on(
    "space:webrtc:answer",
    async ({ spaceId, targetUserId, answer, fromUserId }) => {
      if (!userId || !spaceId || !targetUserId || !answer) {
        console.error("Invalid WebRTC answer parameters");
        return;
      }

      try {
        const Space = (await import("../Models/spaceModel.js")).default;
        const space = await Space.findById(spaceId);
        if (!space) {
          console.error(`Space ${spaceId} not found`);
          return;
        }

        const isParticipant =
          space.hostId.toString() === userId.toString() ||
          space.speakers.some((s) => s.toString() === userId.toString()) ||
          space.listeners.some((l) => l.toString() === userId.toString());

        if (!isParticipant) {
          console.error(
            `User ${userId} is not a participant in space ${spaceId}`
          );
          return;
        }

        // Relay answer to target user
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("space:webrtc:answer", {
            spaceId,
            fromUserId: userId,
            answer,
          });
          console.log(
            `📥 WebRTC answer relayed: ${userId} → ${targetUserId} in space ${spaceId}`
          );
        } else {
          console.warn(`⚠️ Target user ${targetUserId} not connected`);
        }
      } catch (error) {
        console.error("Error in space:webrtc:answer:", error);
      }
    }
  );

  // WebRTC ICE candidate
  socket.on(
    "space:webrtc:ice",
    async ({ spaceId, targetUserId, candidate, fromUserId }) => {
      if (!userId || !spaceId || !targetUserId || !candidate) {
        console.error("Invalid WebRTC ICE parameters");
        return;
      }

      try {
        const Space = (await import("../Models/spaceModel.js")).default;
        const space = await Space.findById(spaceId);
        if (!space) {
          return;
        }

        const isParticipant =
          space.hostId.toString() === userId.toString() ||
          space.speakers.some((s) => s.toString() === userId.toString()) ||
          space.listeners.some((l) => l.toString() === userId.toString());

        if (!isParticipant) {
          return;
        }

        // Relay ICE candidate to target user
        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("space:webrtc:ice", {
            spaceId,
            fromUserId: userId,
            candidate,
          });
        }
      } catch (error) {
        console.error("Error in space:webrtc:ice:", error);
      }
    }
  );

  // WebRTC ready (peer is ready to negotiate)
  socket.on(
    "space:webrtc:ready",
    async ({ spaceId, targetUserId, fromUserId }) => {
      if (!userId || !spaceId || !targetUserId) {
        return;
      }

      try {
        const Space = (await import("../Models/spaceModel.js")).default;
        const space = await Space.findById(spaceId);
        if (!space) return;

        const isParticipant =
          space.hostId.toString() === userId.toString() ||
          space.speakers.some((s) => s.toString() === userId.toString()) ||
          space.listeners.some((l) => l.toString() === userId.toString());

        if (!isParticipant) return;

        const targetSocketId = userSocketMap[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("space:webrtc:ready", {
            spaceId,
            fromUserId: userId,
          });
        }
      } catch (error) {
        console.error("Error in space:webrtc:ready:", error);
      }
    }
  );

  io.emit("getOnlineUsers", Object.keys(userSocketMap)); // [1,2,3,4,5]
  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);

    // Clear all typing states for this user across all chats
    typingState.forEach((userMap, chatId) => {
      if (userMap.has(userId)) {
        userMap.delete(userId);
        // Emit typing stop to all chats this user was typing in
        io.to(`chat:${chatId}`).emit("chat:typing", {
          chatId,
          userId,
          isTyping: false,
        });
        if (userMap.size === 0) {
          typingState.delete(chatId);
        }
      }
    });

    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // io.emit means all users
  });
});

// Log when Socket.IO is ready
io.engine.on("connection_error", (err) => {
  console.error("❌ Socket.IO connection error:", err);
});

// Verify server is set up correctly
console.log("🔌 Socket.IO server initialized");

export { io, server, app };
