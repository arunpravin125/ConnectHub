import express from "express";
import {
  followUnFollowUser,
  freezeAccount,
  getSuggestedUsers,
  getUserProfile,
  loginUser,
  logoutUser,
  searchUsers,
  signupUser,
  updateUser,
} from "../controllers/userController.js";
import { protectRoute } from "../middleware/protectRoute.js";

export const userRoutes = express.Router();

userRoutes.get("/profile/:query", getUserProfile);
userRoutes.get("/suggested/", protectRoute, getSuggestedUsers);
userRoutes.get("/search", protectRoute, searchUsers);
userRoutes.post("/signup", signupUser);
userRoutes.post("/login", loginUser);
userRoutes.post("/logout", logoutUser);
userRoutes.post("/follow/:id", protectRoute, followUnFollowUser);
userRoutes.put("/update/:id", protectRoute, updateUser);
userRoutes.put("/freeze", protectRoute, freezeAccount);
