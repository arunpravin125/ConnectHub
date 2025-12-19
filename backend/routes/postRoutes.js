import express from "express";
import {
  createPost,
  deletePost,
  getFeedPost,
  getPosts,
  getUserPosts,
  getUserReposts,
  likeUnlikePost,
  replyToPost,
  repostPost,
  quotePost,
  undoRepost,
  saveUnsavePost,
  getSavedPosts,
} from "../controllers/postController.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { uploadVideo } from "../middleware/uploadVideo.js";
import { streamVideo } from "../controllers/videoController.js";

export const postRoutes = express.Router();

// Specific routes first (before generic :id route)
postRoutes.get("/feed", protectRoute, getFeedPost);
postRoutes.get("/user/:username", getUserPosts);
postRoutes.get("/user/:username/reposts", getUserReposts);
postRoutes.post(
  "/create",
  protectRoute,
  uploadVideo.single("video"),
  createPost
);
postRoutes.get("/video/:fileId", streamVideo);

// Action routes (with /:id prefix but specific actions)
// IMPORTANT: These must come BEFORE the generic /:id route
postRoutes.put("/like/:id", protectRoute, likeUnlikePost);
postRoutes.put("/reply/:id", protectRoute, replyToPost);
postRoutes.put("/save/:id", protectRoute, saveUnsavePost);
postRoutes.get("/saved/me", protectRoute, getSavedPosts);
// Repost routes - using explicit paths to avoid route matching issues
postRoutes.post(
  "/:id/repost",
  protectRoute,
  (req, res, next) => {
    console.log("📌 POST /:id/repost route matched - ID:", req.params.id);
    next();
  },
  repostPost
);
postRoutes.post(
  "/:id/quote",
  protectRoute,
  (req, res, next) => {
    console.log("📌 POST /:id/quote route matched - ID:", req.params.id);
    next();
  },
  quotePost
);
postRoutes.delete("/:id/repost", protectRoute, undoRepost);

// Generic routes last
postRoutes.get("/:id", getPosts);
postRoutes.delete("/:id", protectRoute, deletePost);

// Debug: Log all registered routes on server start
if (process.env.NODE_ENV !== "production") {
  setTimeout(() => {
    console.log("\n📋 Registered Post Routes:");
    postRoutes.stack.forEach((r) => {
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
