import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  getConversation,
  getMessages,
  sendMessage,
  deleteForMe,
  deleteForEveryone,
} from "../controllers/messageController.js";
import {
  createGroup,
  addMembers,
  removeMember,
  updateMemberRole,
  leaveGroup,
  updateGroupInfo,
} from "../controllers/groupChatController.js";
import multer from "multer";

// Configure multer for file uploads (memory storage for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for documents (increased from 10MB)
    fieldSize: 20 * 1024 * 1024, // 20MB limit for form fields
  },
  fileFilter: (req, file, cb) => {
    // Accept images, videos, audio, PDFs, and Word documents
    const allowedTypes = [
      "image/",
      "video/",
      "audio/",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    // Check MIME type
    const isValidMimeType =
      allowedTypes.some((type) => file.mimetype.startsWith(type)) ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/octet-stream"; // Allow octet-stream (might be audio/webm from MediaRecorder)

    // Also check filename extension for audio files (MediaRecorder might not set MIME type correctly)
    const fileName = file.originalname.toLowerCase();
    const isValidAudioExtension =
      fileName.endsWith(".webm") ||
      fileName.endsWith(".ogg") ||
      fileName.endsWith(".wav") ||
      fileName.endsWith(".mp3") ||
      fileName.endsWith(".m4a");

    if (isValidMimeType || isValidAudioExtension) {
      cb(null, true);
    } else {
      console.log(
        "File rejected - MIME type:",
        file.mimetype,
        "Filename:",
        file.originalname
      );
      cb(
        new Error(
          "Only images, videos, audio, PDF, DOC, and DOCX files are allowed"
        ),
        false
      );
    }
  },
});

export const messageRoutes = express.Router();

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  console.error("Multer error:", err);
  if (err instanceof multer.MulterError) {
    console.error("Multer error code:", err.code);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        details: "Maximum file size is 20MB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Unexpected file field",
        details: "Please use 'file' as the field name",
      });
    }
    return res.status(400).json({
      error: "File upload error",
      details: err.message,
    });
  }
  if (err) {
    console.error("File upload error:", err.message);
    return res.status(400).json({
      error: err.message || "File upload error",
    });
  }
  next();
};

// Group chat routes (must come before generic routes)
messageRoutes.post("/group", protectRoute, createGroup);
messageRoutes.post("/:chatId/members", protectRoute, addMembers);
messageRoutes.delete("/:chatId/members/:memberId", protectRoute, removeMember);
messageRoutes.post(
  "/:chatId/members/:memberId/role",
  protectRoute,
  updateMemberRole
);
messageRoutes.post("/:chatId/leave", protectRoute, leaveGroup);
messageRoutes.put("/:chatId/info", protectRoute, updateGroupInfo);

// Existing message routes
messageRoutes.post(
  "/",
  protectRoute,
  upload.single("file"),
  handleMulterError,
  sendMessage
);
messageRoutes.post("/users", protectRoute, getConversation);
// Delete routes must come before the generic :otherUserId route
messageRoutes.post("/:messageId/delete-for-me", protectRoute, deleteForMe);
messageRoutes.post(
  "/:messageId/delete-for-everyone",
  protectRoute,
  deleteForEveryone
);
// Get messages - support both direct (otherUserId) and group (conversationId)
messageRoutes.get("/conversation/:conversationId", protectRoute, getMessages);
messageRoutes.get("/:otherUserId", protectRoute, getMessages);
