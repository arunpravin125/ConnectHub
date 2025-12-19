import Story from "../Models/storyModel.js";
import User from "../Models/userModel.js";
import { v2 as cloudinary } from "cloudinary";

/**
 * Create a new story
 */
export const createStory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { mediaType, media, caption } = req.body;

    if (!mediaType || !media) {
      return res.status(400).json({
        error: "mediaType and media are required",
      });
    }

    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({
        error: "mediaType must be 'image' or 'video'",
      });
    }

    // Upload media to Cloudinary
    let mediaUrl;
    try {
      const uploadOptions = {
        resource_type: mediaType,
        folder: `threads/stories/${mediaType}s`,
        transformation: [],
      };

      if (mediaType === "image") {
        uploadOptions.transformation = [
          { width: 1080, height: 1920, crop: "limit", quality: "auto" },
        ];
      } else if (mediaType === "video") {
        uploadOptions.transformation = [
          {
            video_codec: "h264",
            audio_codec: "aac",
            format: "mp4",
            quality: "auto:good",
            max_video_duration: 15, // Stories max 15 seconds
          },
        ];
        uploadOptions.chunk_size = 6000000;
      }

      const uploadedResponse = await cloudinary.uploader.upload(media, uploadOptions);
      mediaUrl = uploadedResponse.secure_url;

      if (!mediaUrl) {
        throw new Error("Cloudinary returned empty URL");
      }
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(500).json({
        error: "Failed to upload media: " + uploadError.message,
      });
    }

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create story
    const story = new Story({
      userId,
      mediaType,
      mediaUrl,
      caption: caption || null,
      expiresAt,
      views: [],
      visibleTo: "public",
    });

    await story.save();

    // Populate user info
    await story.populate("userId", "username name profilePic");

    res.status(201).json({
      success: true,
      story: {
        id: story._id,
        userId: story.userId._id,
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        views: story.views,
      },
    });
  } catch (error) {
    console.error("Error in createStory:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get stories feed - returns users with active stories
 */
export const getStoriesFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Get all active stories (not expired)
    const activeStories = await Story.find({
      expiresAt: { $gt: now },
      visibleTo: "public",
    })
      .populate("userId", "username name profilePic")
      .sort({ createdAt: -1 })
      .lean();

    // Group stories by user
    const userStoriesMap = new Map();

    activeStories.forEach((story) => {
      const user = story.userId;
      const userIdStr = user._id.toString();

      if (!userStoriesMap.has(userIdStr)) {
        userStoriesMap.set(userIdStr, {
          user: {
            id: user._id,
            name: user.name,
            username: user.username,
            avatarUrl: user.profilePic || "",
          },
          stories: [],
          hasUnviewed: false,
          latestStoryAt: null,
        });
      }

      const userData = userStoriesMap.get(userIdStr);
      userData.stories.push(story);

      // Check if current user has viewed this story
      const isViewed = story.views.some(
        (view) => view.userId.toString() === userId.toString()
      );

      if (!isViewed) {
        userData.hasUnviewed = true;
      }

      // Track latest story time
      if (!userData.latestStoryAt || story.createdAt > userData.latestStoryAt) {
        userData.latestStoryAt = story.createdAt;
      }
    });

    // Convert to array and sort: unviewed first, then by latestStoryAt
    const storiesFeed = Array.from(userStoriesMap.values())
      .map((item) => ({
        user: item.user,
        hasUnviewed: item.hasUnviewed,
        latestStoryAt: item.latestStoryAt,
        storyCount: item.stories.length,
      }))
      .sort((a, b) => {
        // Unviewed stories first
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        // Then by latest story time
        return new Date(b.latestStoryAt) - new Date(a.latestStoryAt);
      });

    res.status(200).json({ stories: storiesFeed });
  } catch (error) {
    console.error("Error in getStoriesFeed:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get stories for a specific user
 */
export const getUserStories = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const currentUserId = req.user._id;
    const now = new Date();

    // Get active stories for this user
    const stories = await Story.find({
      userId,
      expiresAt: { $gt: now },
      visibleTo: "public",
    })
      .sort({ createdAt: 1 }) // Oldest first for sequential viewing
      .lean();

    // Format response with viewed status
    const formattedStories = stories.map((story) => {
      const isViewedByMe = story.views && story.views.some(
        (view) => {
          const viewUserId = typeof view.userId === 'object' ? view.userId._id : view.userId;
          return viewUserId.toString() === currentUserId.toString();
        }
      );

      return {
        id: story._id,
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isViewedByMe: !!isViewedByMe,
        viewCount: story.views ? story.views.length : 0,
      };
    });

    res.status(200).json({ stories: formattedStories });
  } catch (error) {
    console.error("Error in getUserStories:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mark a story as viewed
 */
export const markStoryViewed = async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    // Check if already viewed (idempotent)
    const alreadyViewed = story.views.some(
      (view) => view.userId.toString() === userId.toString()
    );

    if (!alreadyViewed) {
      story.views.push({
        userId,
        viewedAt: new Date(),
      });
      await story.save();
    }

    res.status(200).json({
      success: true,
      viewed: true,
      viewCount: story.views.length,
    });
  } catch (error) {
    console.error("Error in markStoryViewed:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a story (owner only)
 */
export const deleteStory = async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    if (story.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this story" });
    }

    // Attempt to delete media from Cloudinary (best-effort)
    if (story.mediaUrl) {
      try {
        const parts = story.mediaUrl.split("/");
        const lastPart = parts[parts.length - 1];
        const publicId = lastPart.split(".")[0];
        await cloudinary.uploader.destroy(publicId, {
          resource_type: story.mediaType === "video" ? "video" : "image",
        });
      } catch (e) {
        console.warn("Failed to delete story media from Cloudinary:", e.message);
      }
    }

    await Story.deleteOne({ _id: storyId });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in deleteStory:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update story caption (owner only)
 */
export const updateStory = async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const { caption } = req.body;
    const userId = req.user._id;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    if (story.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to edit this story" });
    }

    if (caption && caption.length > 2200) {
      return res
        .status(400)
        .json({ error: "Caption must be 2200 characters or less" });
    }

    story.caption = caption || null;
    await story.save();

    res.status(200).json({
      success: true,
      story: {
        id: story._id,
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error in updateStory:", error);
    res.status(500).json({ error: error.message });
  }
};

