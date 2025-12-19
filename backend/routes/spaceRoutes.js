import express from "express";
import {
  createSpace,
  getSpace,
  startSpace,
  endSpace,
  startRecording,
  stopRecording,
  uploadRecording,
  getSpaceRecordings,
  getRecording,
  streamRecording,
  joinAsSpeaker,
  joinAsListener,
  leaveSpace,
  getLiveSpaces,
} from "../controllers/spaceController.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { checkSpaceHost } from "../middleware/checkSpaceHost.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for recording uploads
const upload = multer({
  dest: path.join(__dirname, "../uploads/recordings"),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio/video files
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio/video files are allowed"), false);
    }
  },
});

export const spaceRoutes = express.Router();

// Public routes - specific routes must come before parameterized routes
spaceRoutes.get("/live", getLiveSpaces);
spaceRoutes.get("/:id", getSpace);

// Debug: Log all registered routes on server start
if (process.env.NODE_ENV !== "production") {
  setTimeout(() => {
    console.log("\n📋 Registered Space Routes:");
    spaceRoutes.stack.forEach((r) => {
      if (r.route) {
        const methods = Object.keys(r.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
        console.log(`  ${methods.padEnd(10)} ${r.route.path}`);
      }
    });
    console.log("");
  }, 100);
}

// Protected routes (require authentication)
spaceRoutes.post("/", protectRoute, createSpace);
spaceRoutes.post("/:id/join/speaker", protectRoute, joinAsSpeaker);
spaceRoutes.post("/:id/join/listener", protectRoute, joinAsListener);
spaceRoutes.post("/:id/leave", protectRoute, leaveSpace);

// Host-only routes
spaceRoutes.post("/:id/start", protectRoute, checkSpaceHost, startSpace);
spaceRoutes.post("/:id/end", protectRoute, checkSpaceHost, endSpace);
spaceRoutes.post("/:id/record/start", protectRoute, checkSpaceHost, startRecording);
spaceRoutes.post("/:id/record/stop", protectRoute, checkSpaceHost, stopRecording);
spaceRoutes.post(
  "/:id/record/upload/:recordingId",
  protectRoute,
  checkSpaceHost,
  upload.single("recording"),
  uploadRecording
);
spaceRoutes.get("/:id/recordings", protectRoute, checkSpaceHost, getSpaceRecordings);
spaceRoutes.get("/recordings/:rid", protectRoute, getRecording);
spaceRoutes.get("/recordings/:rid/stream", protectRoute, streamRecording);

