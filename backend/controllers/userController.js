import User from "../Models/userModel.js";
import bcrypt from "bcryptjs";
import { generateTokenAndSetCookie } from "../utils/helpers/generateTokensAndSetCookies.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Post from "../Models/postModel.js";
import Notification from "../Models/notificaionModel.js";

export const signupUser = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });

    await newUser.save();
    if (newUser) {
      generateTokenAndSetCookie(newUser._id, res);
      //
      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
        followers: newUser.followers,
        following: newUser.following,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.log("error in signupController", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user?.password || ""
    );
    if (!user || !isPasswordCorrect) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    if (user.isFrozen) {
      user.isFrozen = false;
      await user.save();
    }
    generateTokenAndSetCookie(user._id, res);
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.log("error in loginuset:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    // console.log(res.cookie("jwt"))
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(201).json({ message: " User Logout Successfully" });
  } catch (error) {
    console.log("error in logout:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const followUnFollowUser = async (req, res) => {
  try {
    const { id } = req.params; // others id
    const userToModify = await User.findById(id); // finding other profile with help of id
    const currentUser = await User.findById(req.user._id); // by proctectRoute

    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "You cannot  follow/unfollow yourself" });
    }

    if (!userToModify || !currentUser) {
      return res.status(400).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following.includes(id);
    if (isFollowing) {
      // unfollow user
      // modify current user following, modigfy followers of userToModiify
      await User.updateOne({ _id: id }, { $pull: { followers: req.user._id } });
      await User.updateOne({ _id: req.user._id }, { $pull: { following: id } });
      // await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
      // login user ku pooie following array la {id=>already following Id} remove pandrom aprm {update vera pannanum follow pannuna gla } pooi remove pannanum follwers array la eruthu
      // await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });

      res.status(200).json({ message: "User unfollowed successfully" });
    } else {
      await User.updateOne({ _id: id }, { $push: { followers: req.user._id } });
      await User.updateOne({ _id: req.user._id }, { $push: { following: id } });
      //follow user
      // await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
      // await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
      const notification = new Notification({
        type: "follow",
        from: currentUser._id,
        to: userToModify._id,
      });
      res.status(200).json({ message: "User followed successfully" });
    }
  } catch (error) {
    console.log("error in followUnFollowUser:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  var { name, email, password, username, bio } = req.body;
  var { profilePic } = req.body;
  const userId = req.user._id;

  try {
    let user = await User.findById(userId);

    if (req.params.id !== userId.toString()) {
      return res
        .status(400)
        .json({ error: "You cannod update other user's profile" });
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      user.password = hashPassword;
    }

    if (profilePic) {
      if (user.profilePic) {
        await cloudinary.uploader.destroy(
          user.profilePic.split("/").pop().split(".")[0]
        );
      }
      const uploadedResponse = await cloudinary.uploader.upload(profilePic);
      profilePic = uploadedResponse.secure_url;
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;
    user.profilePic = profilePic || user.profilePic;
    user.bio = bio || user.bio;

    user = await user.save();

    await Post.updateMany(
      { "replies.userId": userId }, // id
      {
        $set: {
          "replies.$[r].username": user.username,
          "replies.$[r].userProfilePic": user.profilePic,
        }, // update things
      },
      { arrayFilters: [{ "r.userId": userId }] } // filter
    );

    user.password = null;
    res.status(200).json(user);
  } catch (error) {
    console.log("error inupdateUser:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  const { query } = req.params;
  // we will fetch profile either user name or id

  // query is either username or userId
  try {
    // Validate query parameter
    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "User ID or username is required" });
    }

    // Check MongoDB connection state
    if (mongoose.connection.readyState !== 1) {
      console.error(
        "MongoDB connection not ready. State:",
        mongoose.connection.readyState
      );
      return res.status(503).json({
        error: "Database connection unavailable. Please try again.",
      });
    }

    let user;

    // Check if query is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(query)) {
      try {
        user = await User.findById(query)
          .select("-password -updatedAt")
          .lean()
          .maxTimeMS(5000); // 5 second timeout
      } catch (dbError) {
        console.error("Database error in getUserProfile (by ID):", dbError);
        // Check if it's a connection error
        if (
          dbError.name === "MongoNetworkError" ||
          dbError.name === "MongoServerSelectionError" ||
          dbError.message.includes("ECONNRESET") ||
          dbError.message.includes("connection")
        ) {
          return res.status(503).json({
            error: "Database connection error. Please try again.",
          });
        }
        throw dbError;
      }
    } else {
      // Query by username
      try {
        user = await User.findOne({ username: query.trim() })
          .select("-password -updatedAt")
          .lean()
          .maxTimeMS(5000); // 5 second timeout
      } catch (dbError) {
        console.error(
          "Database error in getUserProfile (by username):",
          dbError
        );
        // Check if it's a connection error
        if (
          dbError.name === "MongoNetworkError" ||
          dbError.name === "MongoServerSelectionError" ||
          dbError.message.includes("ECONNRESET") ||
          dbError.message.includes("connection")
        ) {
          return res.status(503).json({
            error: "Database connection error. Please try again.",
          });
        }
        throw dbError;
      }
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    // Handle specific error types
    if (
      error.name === "MongoNetworkError" ||
      error.name === "MongoServerSelectionError" ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("connection")
    ) {
      return res.status(503).json({
        error: "Database connection error. Please try again later.",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    // exclude the current user from suggested user array,excludes users that current user is already following

    const userId = req.user._id;

    const usersFollowedByYou = await User.findById(userId).select("following");

    if (!usersFollowedByYou) {
      return res.status(404).json({ error: "User not found" });
    }

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $sample: { size: 10 },
      },
    ]);
    
    // Convert following array to string array for comparison
    const followingIds = usersFollowedByYou.following.map((id) => id.toString());
    
    const filteredUsers = users.filter(
      (user) => !followingIds.includes(user._id.toString())
    );
    const suggestedUser = filteredUsers.slice(0, 4);
    suggestedUser.forEach((user) => {
      user.password = null;
      // Convert _id to string for JSON serialization
      user._id = user._id.toString();
    });
    res.status(200).json(suggestedUser);
  } catch (error) {
    console.log("error in suggestedUser", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user?._id;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchQuery = query.trim();

    // Build search filter
    const searchFilter = {
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { name: { $regex: searchQuery, $options: "i" } },
      ],
    };

    // Exclude current user if authenticated
    if (userId) {
      searchFilter._id = { $ne: userId };
    }

    // Search users by username or name (case-insensitive, partial match)
    const users = await User.find(searchFilter)
      .select("-password -updatedAt")
      .limit(10) // Limit to 10 suggestions
      .lean()
      .maxTimeMS(5000);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in searchUsers:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const freezeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ error: "User Not found" });
    }

    user.isFrozen = true;
    await user.save();
    res.status(200).json({ success: "true" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
