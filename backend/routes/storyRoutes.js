import express from "express";
import {
  createStory,
  getStoriesFeed,
  getUserStories,
  markStoryViewed,
  deleteStory,
  updateStory,
  replyToStory,
} from "../controllers/storyController.js";
import { protectRoute } from "../middleware/protectRoute.js";

export const storyRoutes = express.Router();

storyRoutes.post("/", protectRoute, createStory);
storyRoutes.get("/feed", protectRoute, getStoriesFeed);
storyRoutes.get("/user/:id", protectRoute, getUserStories);
storyRoutes.post("/:id/view", protectRoute, markStoryViewed);
storyRoutes.post("/:id/reply", protectRoute, replyToStory);
storyRoutes.delete("/:id", protectRoute, deleteStory);
storyRoutes.put("/:id", protectRoute, updateStory);
