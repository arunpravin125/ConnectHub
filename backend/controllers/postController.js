import Notification from "../Models/notificaionModel.js";
import Post from "../Models/postModel.js";
import User from "../Models/userModel.js";
import Repost from "../Models/repostModel.js";
import { v2 as cloudinary } from "cloudinary";
import { getRecipiantSocketId, io } from "../socket/socket.js";
import mongoose from "mongoose";

export const getPosts = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const post = await Post.findById(req.params.id)
      .populate("postedBy", "username name profilePic")
      .populate("replies.userId", "username name profilePic");

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Get repost counts
    const repostCount = await Repost.countDocuments({
      originalPostId: post._id,
      type: "repost",
    });
    const quoteCount = await Repost.countDocuments({
      originalPostId: post._id,
      type: "quote",
    });

    // Check if current user has reposted (if authenticated)
    let viewerReposted = false;
    if (userId) {
      const userRepost = await Repost.findOne({
        userId,
        originalPostId: post._id,
      });
      viewerReposted = !!userRepost;
    }

    // Ensure video and img fields are explicitly included (even if null)
    const postObj = post.toObject();
    const responsePost = {
      ...postObj,
      video:
        postObj.video !== undefined && postObj.video !== null
          ? postObj.video
          : null,
      img:
        postObj.img !== undefined && postObj.img !== null ? postObj.img : null,
      repostCount: repostCount + quoteCount,
      viewerState: {
        reposted: viewerReposted,
      },
    };

    console.log("getPosts - Post video field:", responsePost.video);
    console.log("getPosts - Post img field:", responsePost.img);
    res.status(200).json(responsePost);
  } catch (error) {
    console.log("error in getPost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const { postedBy, text } = req.body;
    let { img, video } = req.body;

    // Check if video file was uploaded via multipart/form-data (GridFS)
    const videoFile = req.file;

    // ========== VALIDATION ==========
    if (!postedBy) {
      return res.status(400).json({
        error: "postedBy field is required",
      });
    }

    // Text is optional but if provided, must be valid
    if (text !== undefined && text !== null) {
      const maxLength = 500;
      if (typeof text !== "string") {
        return res.status(400).json({
          error: "Text must be a string",
        });
      }
      if (text.length > maxLength) {
        return res.status(400).json({
          error: `Text must be less than ${maxLength} characters`,
        });
      }
    }

    // Ensure text is a string (can be empty)
    const postText = text || "";

    // Validate user exists and is authorized
    const user = await User.findById(postedBy);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user._id.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: "Unauthorized to create post" });
    }

    // Validate media inputs (only one type allowed)
    const hasVideoInput =
      video &&
      typeof video === "string" &&
      video.trim() !== "" &&
      video !== "null";
    const hasImgInput =
      img && typeof img === "string" && img.trim() !== "" && img !== "null";

    if (hasVideoInput && hasImgInput) {
      return res.status(400).json({
        error: "Cannot upload both image and video in the same post",
      });
    }

    // ========== MEDIA UPLOAD TO CLOUDINARY ==========
    // Upload image if provided
    if (hasImgInput) {
      try {
        console.log("📤 Uploading image to Cloudinary...");
        const uploadedResponse = await cloudinary.uploader.upload(img, {
          resource_type: "image",
          folder: "threads/posts/images",
          transformation: [
            { width: 1000, height: 1000, crop: "limit", quality: "auto" },
          ],
        });
        img = uploadedResponse.secure_url;
        console.log(
          "✅ Image uploaded successfully:",
          uploadedResponse.public_id
        );
      } catch (cloudinaryError) {
        console.error("❌ Cloudinary image upload error:", cloudinaryError);
        return res.status(500).json({
          error: "Failed to upload image to Cloudinary",
          details: cloudinaryError.message,
        });
      }
    }

    // Upload video if provided
    if (hasVideoInput) {
      try {
        console.log("📤 Uploading video to Cloudinary...");
        console.log("Video data length:", video.length);

        const uploadedResponse = await cloudinary.uploader.upload(video, {
          resource_type: "video",
          folder: "threads/posts/videos",
          chunk_size: 13000000, // 13MB chunks for better reliability with larger files
          eager: [{ width: 300, height: 300, crop: "fill", format: "jpg" }],
          eager_async: true,
          transformation: [
            {
              video_codec: "h264",
              audio_codec: "aac",
              format: "mp4",
              quality: "auto:good",
            },
          ],
        });

        video = uploadedResponse.secure_url;

        // Validate video URL
        if (!video || video.trim() === "") {
          throw new Error("Cloudinary returned empty video URL");
        }

        if (video.includes("/image/upload/")) {
          throw new Error(
            "Cloudinary uploaded video as image - check resource_type"
          );
        }

        if (!video.includes("/video/upload/")) {
          throw new Error("Invalid video URL format from Cloudinary");
        }

        // Ensure it's a Cloudinary URL (res.cloudinary.com)
        if (!video.includes("res.cloudinary.com")) {
          throw new Error("Video URL must be from Cloudinary");
        }

        console.log(
          "✅ Video uploaded successfully:",
          uploadedResponse.public_id
        );
        console.log("✅ Video URL after upload:", video);
        console.log("✅ Video URL length:", video.length);
        console.log("✅ Video URL type:", typeof video);
        console.log(
          "✅ Video URL includes res.cloudinary.com:",
          video.includes("res.cloudinary.com")
        );
        console.log(
          "✅ Video URL includes /video/upload/:",
          video.includes("/video/upload/")
        );
      } catch (cloudinaryError) {
        console.error("❌ Cloudinary video upload error:", cloudinaryError);
        return res.status(500).json({
          error: "Failed to upload video to Cloudinary",
          details: cloudinaryError.message,
        });
      }
    } else {
      // No video input - ensure video is undefined/null
      video = undefined;
      console.log("⚠️ No video input provided");
    }

    // ========== BUILD POST DATA ==========
    // Log state before building postData
    console.log("🔍 Building postData - Current state:");
    console.log(
      "  - img:",
      img ? img.substring(0, 50) + "..." : "null/undefined",
      "type:",
      typeof img
    );
    console.log(
      "  - video:",
      video ? video.substring(0, 50) + "..." : "null/undefined",
      "type:",
      typeof video
    );
    console.log("  - hasImgInput:", hasImgInput);
    console.log("  - hasVideoInput:", hasVideoInput);
    console.log("  - video length:", video?.length);
    console.log("  - video starts with:", video?.substring(0, 30));

    const postData = {
      postedBy,
      text: postText, // Use validated postText
    };

    // Set the appropriate media field (after Cloudinary upload, img/video are URLs or null)
    // Priority: video > img > neither
    // CRITICAL: Check video FIRST since it has higher priority

    // First, check if video exists and is valid Cloudinary URL
    const isVideoValid =
      video !== undefined &&
      video !== null &&
      typeof video === "string" &&
      video.trim() !== "" &&
      video !== "null" &&
      video.includes("res.cloudinary.com") &&
      video.includes("/video/upload/");

    // Then check if img exists and is valid Cloudinary URL
    const isImgValid =
      img !== undefined &&
      img !== null &&
      typeof img === "string" &&
      img.trim() !== "" &&
      img !== "null" &&
      img.includes("res.cloudinary.com");

    console.log("🔍 Validation results:");
    console.log("  - isVideoValid:", isVideoValid);
    console.log("  - isImgValid:", isImgValid);
    console.log("  - video exists:", video !== undefined && video !== null);
    console.log("  - video is string:", typeof video === "string");
    if (video && typeof video === "string") {
      console.log("  - video trimmed length:", video.trim().length);
      console.log(
        "  - video has res.cloudinary.com:",
        video.includes("res.cloudinary.com")
      );
      console.log(
        "  - video has /video/upload/:",
        video.includes("/video/upload/")
      );
    }

    // Handle GridFS video file upload (multipart/form-data)
    if (hasVideoFile) {
      postData.videoFileId = videoFile.id;
      postData.hasVideo = true;
      postData.video = null; // Clear old video URL field
      postData.img = null; // Explicitly set img to null when video is set
      console.log("✅✅✅ GRIDFS VIDEO SET in postData:", videoFile.id);
      console.log("✅✅✅ Video filename:", videoFile.filename);
    } else if (isVideoValid) {
      // Legacy: Cloudinary/base64 video (keep for backward compatibility)
      postData.video = video;
      postData.videoFileId = null;
      postData.hasVideo = false; // Keep false for Cloudinary videos
      postData.img = null; // Explicitly set img to null when video is set
      console.log(
        "✅✅✅ VIDEO SET in postData:",
        video.substring(0, 50) + "..."
      );
      console.log("✅✅✅ Full video URL:", video);
    } else if (isImgValid) {
      postData.img = img;
      postData.video = null; // Explicitly set video to null when img is set
      postData.videoFileId = null;
      postData.hasVideo = false;
      console.log("✅ IMG SET in postData:", img.substring(0, 50) + "...");
    } else {
      // Neither img nor video - set both to null explicitly
      postData.img = null;
      postData.video = null;
      postData.videoFileId = null;
      postData.hasVideo = false;
      console.log("⚠️ Neither img nor video - both set to null");
      if (hasVideoInput) {
        console.error(
          "❌❌❌ ERROR: Video was uploaded but not set in postData!"
        );
        console.error("  - hasVideoInput:", hasVideoInput);
        console.error("  - video value:", video);
        console.error("  - video type:", typeof video);
        console.error("  - video === null:", video === null);
        console.error("  - video === undefined:", video === undefined);
        console.error("  - video length:", video?.length);
        if (video && typeof video === "string") {
          console.error("  - video.trim():", video.trim());
          console.error(
            "  - video.includes('res.cloudinary.com'):",
            video.includes("res.cloudinary.com")
          );
          console.error(
            "  - video.includes('/video/upload/'):",
            video.includes("/video/upload/")
          );
        }
        // CRITICAL FIX: If video was uploaded but validation failed, still save it
        // This handles edge cases where Cloudinary URL format might be slightly different
        if (
          video &&
          typeof video === "string" &&
          video.trim() !== "" &&
          video !== "null"
        ) {
          console.warn(
            "⚠️ Video validation failed but attempting to save anyway"
          );
          console.warn("⚠️ Video URL:", video);
          postData.video = video;
          if (postData.img) {
            postData.img = null; // Clear img if video is being saved
          }
        }
      }
    }

    console.log("📋 Final postData before save:");
    console.log("  - postedBy:", postData.postedBy);
    console.log("  - text:", postData.text?.substring(0, 30) + "...");
    console.log("  - img:", postData.img);
    console.log("  - video:", postData.video);
    console.log("  - hasImg:", !!postData.img);
    console.log("  - hasVideo:", !!postData.video);
    console.log("  - All keys:", Object.keys(postData));
    // ========== SAVE TO DATABASE ==========
    // CRITICAL: Ensure both fields are ALWAYS in postData
    // For Mongoose to save fields, they must be explicitly set (not null for optional fields)
    // Only set null if we explicitly want to clear a field
    // If field is not in postData, Mongoose will use schema default (null)
    // But we need to ensure video is set if it was uploaded
    if (!("img" in postData) && !("video" in postData)) {
      // Neither field set - use defaults
      postData.img = null;
      postData.video = null;
    } else if ("video" in postData && postData.video) {
      // Video is set - ensure img is null if not already set
      if (!("img" in postData)) {
        postData.img = null;
      }
    } else if ("img" in postData && postData.img) {
      // Img is set - ensure video is null if not already set
      if (!("video" in postData)) {
        postData.video = null;
      }
    }

    console.log("💾 Creating Post instance with data:", {
      postedBy: postData.postedBy,
      text: postData.text?.substring(0, 30),
      img: postData.img,
      video: postData.video,
      hasImg: "img" in postData,
      hasVideo: "video" in postData,
    });

    // CRITICAL: Use create() instead of new + save() to ensure all fields are saved
    // Mongoose create() will save all fields including null values
    console.log("💾 Creating post with Post.create():");
    console.log("  - postData keys:", Object.keys(postData));
    console.log("  - postData.video:", postData.video);
    console.log("  - postData.img:", postData.img);

    const newPost = await Post.create(postData);
    console.log("✅ Post created and saved to database");
    console.log("  - Created post _id:", newPost._id);
    console.log("  - Created post video:", newPost.video);
    console.log("  - Created post img:", newPost.img);
    console.log("  - 'video' in newPost:", "video" in newPost.toObject());
    console.log("  - 'img' in newPost:", "img" in newPost.toObject());

    // CRITICAL FIX: Force update to ensure video/img/GridFS fields are saved
    // This handles the case where Mongoose doesn't save the fields
    if ("video" in postData || "img" in postData || "videoFileId" in postData) {
      const updateData = {};
      if ("video" in postData) {
        updateData.video = postData.video;
      }
      if ("img" in postData) {
        updateData.img = postData.img;
      }
      if ("videoFileId" in postData) {
        updateData.videoFileId = postData.videoFileId;
        updateData.hasVideo = postData.hasVideo;
      }
      await Post.updateOne({ _id: newPost._id }, { $set: updateData });
      console.log("✅ Post fields force-updated:", updateData);
    }

    // Fetch fresh from DB to ensure all fields are included
    const savedPost = await Post.findById(newPost._id).lean(); // Use lean() for plain object

    if (!savedPost) {
      throw new Error("Failed to retrieve saved post");
    }

    // Debug: Log what was actually saved
    console.log("💾 Saved post from DB:");
    console.log("  - _id:", savedPost._id);
    console.log("  - video:", savedPost.video);
    console.log("  - img:", savedPost.img);
    console.log("  - video type:", typeof savedPost.video);
    console.log("  - img type:", typeof savedPost.img);
    console.log("  - video in savedPost:", "video" in savedPost);
    console.log("  - img in savedPost:", "img" in savedPost);
    console.log("  - All keys:", Object.keys(savedPost));
    console.log(
      "  - Full saved post object:",
      JSON.stringify(savedPost, null, 2)
    );

    // ========== PREPARE RESPONSE ==========
    // CRITICAL: Ensure all fields are ALWAYS included in response
    const responsePost = {
      ...savedPost,
      // Explicitly include video field - check if it exists in savedPost
      video: savedPost.hasOwnProperty("video")
        ? savedPost.video !== undefined
          ? savedPost.video
          : null
        : null,
      // Explicitly include img field - check if it exists in savedPost
      img: savedPost.hasOwnProperty("img")
        ? savedPost.img !== undefined
          ? savedPost.img
          : null
        : null,
      // Include GridFS video fields
      videoFileId: savedPost.videoFileId || null,
      hasVideo: savedPost.hasVideo || false,
    };

    // If video was in postData but not in savedPost, force it
    if (postData.video && !responsePost.video) {
      console.warn(
        "⚠️ Video was in postData but missing from savedPost - forcing it"
      );
      responsePost.video = postData.video;
    }

    // Ensure GridFS video fields are included
    if (postData.videoFileId && !responsePost.videoFileId) {
      responsePost.videoFileId = postData.videoFileId;
      responsePost.hasVideo = true;
    }

    console.log("📤 Response post:");
    console.log("  - video:", responsePost.video);
    console.log("  - img:", responsePost.img);
    console.log("  - video in responsePost:", "video" in responsePost);
    console.log("  - img in responsePost:", "img" in responsePost);
    console.log("  - All keys:", Object.keys(responsePost));

    // ========== EMIT REAL-TIME UPDATE ==========
    if (savedPost) {
      io.emit("livePost", { newPost: responsePost });
    }

    // ========== RETURN RESPONSE ==========
    res.status(201).json(responsePost);
  } catch (error) {
    console.error("❌ Error in createPost:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: "Unauthorized to delete post" });
    }

    // Delete image from Cloudinary if exists
    if (post.img) {
      const imgId = post.img.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(imgId, { resource_type: "image" });
    }

    // Delete video from Cloudinary if exists
    if (post.video) {
      const videoId = post.video.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(videoId, { resource_type: "video" });
    }
    await Post.findOneAndDelete({ _id: req.params.id });
    const posts = await Post.find();
    res.status(200).json(posts);
  } catch (error) {
    console.log("error in deletePost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const likeUnlikePost = async (req, res) => {
  try {
    const { id: postId } = req.params; // postId post ooda Id
    const userId = req.user._id; // userlogin

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "No post found" });
    }

    const userfrom = await User.findById(userId);
    const userLikedPost = post.likes.includes(userId);
    if (userLikedPost) {
      // unlike post
      await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });

      const posts = await Post.findById(postId);
      res.status(200).json(posts.likes);
    } else {
      // like post
      post.likes.push(userId);
      await post.save();
      const posts = await Post.findById(postId);
      res.status(200).json(posts.likes);
      if (post.postedBy.toString() !== userId.toString()) {
        const notification = new Notification({
          from: userId,
          to: post.postedBy,
          type: "like",
          postImg: post.img || null,
          postVideo: post.video || null,
          postVideoFileId: post.videoFileId || null,
          hasVideo: post.hasVideo || false,
          likedText: post.text || "",
          postUsername: {
            user: userfrom.username,
          },
          postUserimg: {
            img: userfrom.profilePic,
          },
        });

        await notification.save();
        console.log("notification", notification);

        const recipientSocketId = getRecipiantSocketId(post.postedBy); // using recipients id and socketId
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("live", { notification });
        }
      }
    }
  } catch (error) {
    console.log("error in likeUnlikePost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const replyToPost = async (req, res) => {
  try {
    const { text } = req.body; // comment
    const postId = req.params.id; // that post id
    const userId = req.user._id; // userLogin id check
    const userProfilePic = req.user.profilePic; // userProfile check
    const username = req.user.username; // userLogin user name

    if (!text) {
      return res.status(400).json({ error: "text fields is required" });
    }

    const post = await Post.findById(postId);

    const userfrom = await User.findById(userId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const reply = { userId, text, userProfilePic, username };

    const notification = new Notification({
      type: "reply",
      from: userId,
      to: post.postedBy,
      postImg: post.img || null,
      postVideo: post.video || null,
      postVideoFileId: post.videoFileId || null,
      hasVideo: post.hasVideo || false,
      likedText: post.text || "",
      postUsername: {
        user: userfrom.username,
      },
      postUserimg: {
        img: userfrom.profilePic,
      },
    });

    await notification.save();

    post.replies.push(reply);
    await post.save();
    const postReply = await Post.findById(postId);
    const recipientSocketId = getRecipiantSocketId(post.postedBy); // using recipients id and socketId
    if (recipientSocketId) {
      console.log("recipinet", recipientSocketId);
      io.to(recipientSocketId).emit("commentLive", { notification });
    }
    res.status(200).json(postReply.replies);
  } catch (error) {
    console.log("error in reply to post :", error.message);
    res.status(400).json({ error: error.message });
  }
};

export const getFeedPost = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 20); // Max 20 posts per page
    const skip = (pageNum - 1) * limitNum;

    const following = user.following;

    // Get active breaking news posts (boosted in feed)
    const now = new Date();
    const activeBreakingPosts = await Post.find({
      isBreaking: true,
      breakingExpiresAt: { $gt: now },
    })
      .populate("postedBy", "username name profilePic")
      .sort({ newsPublishedAt: -1, createdAt: -1 })
      .limit(limitNum) // Limit breaking news to avoid overwhelming feed
      .lean();

    // Get posts from users you follow
    const feedPosts = await Post.find({ postedBy: { $in: following } })
      .sort({ createdAt: -1 })
      .limit(limitNum * 2) // Get more to account for reposts
      .skip(skip)
      .lean();

    // Get reposts from users you follow (reposts of posts from anyone)
    const feedReposts = await Repost.find({
      userId: { $in: following },
    })
      .populate("userId", "username name profilePic")
      .populate({
        path: "originalPostId",
        populate: { path: "postedBy", select: "username name profilePic" },
      })
      .sort({ createdAt: -1 })
      .limit(limitNum * 2)
      .skip(skip)
      .lean();

    // Filter out reposts where original post is missing
    const validReposts = feedReposts.filter((repost) => repost.originalPostId);

    // Merge posts and reposts, sort by createdAt
    const feedItems = [];

    // Add active breaking news posts first (boosted)
    activeBreakingPosts.forEach((post) => {
      feedItems.push({
        itemType: "post",
        createdAt: post.createdAt,
        isBreaking: true,
        activeBreaking: true,
        post: {
          ...post,
          video:
            post.video !== undefined && post.video !== null ? post.video : null,
          img: post.img !== undefined && post.img !== null ? post.img : null,
        },
      });
    });

    // Add regular posts
    feedPosts.forEach((post) => {
      // Skip if this post is already in breaking news (avoid duplicates)
      const isDuplicate = activeBreakingPosts.some(
        (bp) => bp._id.toString() === post._id.toString()
      );
      if (isDuplicate) return;

      feedItems.push({
        itemType: "post",
        createdAt: post.createdAt,
        isBreaking: post.isBreaking || false,
        activeBreaking:
          post.isBreaking &&
          post.breakingExpiresAt &&
          new Date(post.breakingExpiresAt) > now,
        post: {
          ...post,
          video:
            post.video !== undefined && post.video !== null ? post.video : null,
          img: post.img !== undefined && post.img !== null ? post.img : null,
        },
      });
    });

    // Add reposts and quotes
    validReposts.forEach((repost) => {
      const originalPost = repost.originalPostId;
      if (originalPost) {
        feedItems.push({
          itemType: repost.type === "quote" ? "quote" : "repost",
          createdAt: repost.createdAt,
          actor: {
            id: repost.userId._id || repost.userId,
            name: repost.userId.name || repost.userId.username,
            username: repost.userId.username,
            profilePic: repost.userId.profilePic,
          },
          post: {
            ...originalPost,
            video:
              originalPost.video !== undefined && originalPost.video !== null
                ? originalPost.video
                : null,
            img:
              originalPost.img !== undefined && originalPost.img !== null
                ? originalPost.img
                : null,
          },
          quoteText: repost.quoteText || null,
          quotePostId: repost.quotePostId || null,
        });
      }
    });

    // Sort: active breaking news first, then by newsPublishedAt (for breaking) or createdAt
    feedItems.sort((a, b) => {
      // Active breaking news always comes first
      if (a.activeBreaking && !b.activeBreaking) return -1;
      if (!a.activeBreaking && b.activeBreaking) return 1;

      // If both are breaking, sort by newsPublishedAt
      if (a.activeBreaking && b.activeBreaking) {
        const aDate = a.post.newsPublishedAt || a.createdAt;
        const bDate = b.post.newsPublishedAt || b.createdAt;
        return new Date(bDate) - new Date(aDate);
      }

      // Otherwise sort by createdAt
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const paginatedItems = feedItems.slice(0, limitNum);

    // Get repost counts and viewer state for each item
    const enrichedItems = await Promise.all(
      paginatedItems.map(async (item) => {
        const postId = item.post._id;

        // Get repost counts
        const repostCount = await Repost.countDocuments({
          originalPostId: postId,
          type: "repost",
        });
        const quoteCount = await Repost.countDocuments({
          originalPostId: postId,
          type: "quote",
        });

        // Check if current user has reposted
        const userRepost = await Repost.findOne({
          userId,
          originalPostId: postId,
        });

        // Get like count and check if user liked
        const likeCount = item.post.likes ? item.post.likes.length : 0;
        const liked = item.post.likes
          ? item.post.likes.some(
              (likeId) =>
                likeId.toString() === userId.toString() ||
                (typeof likeId === "object" &&
                  likeId._id?.toString() === userId.toString())
            )
          : false;

        return {
          ...item,
          counts: {
            likes: likeCount,
            reposts: repostCount + quoteCount,
            replies: item.post.replies ? item.post.replies.length : 0,
          },
          viewerState: {
            liked,
            reposted: !!userRepost,
          },
        };
      })
    );

    // Get total count for pagination (posts + reposts + active breaking news)
    const totalPosts = await Post.countDocuments({
      postedBy: { $in: following },
    });
    const totalReposts = await Repost.countDocuments({
      userId: { $in: following },
    });
    const totalBreaking = await Post.countDocuments({
      isBreaking: true,
      breakingExpiresAt: { $gt: now },
    });
    const totalItems = totalPosts + totalReposts + totalBreaking;

    res.status(200).json({
      posts: enrichedItems,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalPosts: totalItems,
        hasMore: skip + limitNum < totalItems,
      },
    });
  } catch (error) {
    console.log("error in getFeetPosts :", error.message);
    res.status(400).json({ error: error.message });
  }
};

export const getUserPosts = async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 20 } = req.query;
  console.log(username);
  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 20); // Max 20 posts per page
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination info
    const totalPosts = await Post.countDocuments({ postedBy: user._id });

    //   created: -1 => means decending order
    const posts = await Post.find({ postedBy: user._id })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    if (!posts || posts.length === 0) {
      return res.status(200).json({
        posts: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalPosts: 0,
          hasMore: false,
        },
      });
    }

    // Ensure video and img fields are explicitly included for all posts (even if null)
    const responsePosts = posts.map((post) => {
      const postObj = post.toObject();
      return {
        ...postObj,
        video:
          postObj.video !== undefined && postObj.video !== null
            ? postObj.video
            : null,
        img:
          postObj.img !== undefined && postObj.img !== null
            ? postObj.img
            : null,
      };
    });

    console.log("getUserPosts - Total posts:", responsePosts.length);
    if (responsePosts.length > 0) {
      console.log(
        "getUserPosts - Sample post video field:",
        responsePosts[0]?.video
      );
      console.log(
        "getUserPosts - Sample post img field:",
        responsePosts[0]?.img
      );
    }

    res.status(200).json({
      posts: responsePosts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalPosts / limitNum),
        totalPosts,
        hasMore: skip + limitNum < totalPosts,
      },
    });
  } catch (error) {
    console.log("error in getUserPosts : ", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get all reposts (and quotes) created by a specific user
export const getUserReposts = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const viewerId = req.user?._id || null;

    // Find reposts by this user
    const userReposts = await Repost.find({ userId: user._id })
      .populate("userId", "username name profilePic")
      .populate({
        path: "originalPostId",
        populate: { path: "postedBy", select: "username name profilePic" },
      })
      .sort({ createdAt: -1 })
      .lean();

    const validReposts = userReposts.filter((repost) => repost.originalPostId);

    const items = await Promise.all(
      validReposts.map(async (repost) => {
        const originalPost = repost.originalPostId;
        const postId = originalPost._id;

        // Basic counts
        const likeCount = Array.isArray(originalPost.likes)
          ? originalPost.likes.length
          : 0;
        const repliesCount = Array.isArray(originalPost.replies)
          ? originalPost.replies.length
          : 0;

        // Repost / quote counts
        const repostCount = await Repost.countDocuments({
          originalPostId: postId,
          type: "repost",
        });
        const quoteCount = await Repost.countDocuments({
          originalPostId: postId,
          type: "quote",
        });

        // Viewer state (if logged in)
        let liked = false;
        let viewerReposted = false;
        if (viewerId) {
          liked = originalPost.likes
            ? originalPost.likes.some(
                (likeId) =>
                  likeId.toString() === viewerId.toString() ||
                  (typeof likeId === "object" &&
                    likeId._id?.toString() === viewerId.toString())
              )
            : false;

          const viewerRepost = await Repost.findOne({
            userId: viewerId,
            originalPostId: postId,
          });
          viewerReposted = !!viewerRepost;
        }

        return {
          itemType: repost.type === "quote" ? "quote" : "repost",
          createdAt: repost.createdAt,
          actor: {
            id: repost.userId._id || repost.userId,
            name: repost.userId.name || repost.userId.username,
            username: repost.userId.username,
            profilePic: repost.userId.profilePic,
          },
          post: {
            ...originalPost,
            video:
              originalPost.video !== undefined && originalPost.video !== null
                ? originalPost.video
                : null,
            img:
              originalPost.img !== undefined && originalPost.img !== null
                ? originalPost.img
                : null,
          },
          quoteText: repost.quoteText || null,
          quotePostId: repost.quotePostId || null,
          counts: {
            likes: likeCount,
            reposts: repostCount + quoteCount,
            replies: repliesCount,
          },
          viewerState: {
            liked,
            reposted: viewerReposted,
          },
        };
      })
    );

    res.status(200).json({
      posts: items,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalPosts: items.length,
        hasMore: false,
      },
    });
  } catch (error) {
    console.log("error in getUserReposts :", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Repost a post (simple repost without comment)
export const repostPost = async (req, res) => {
  try {
    console.log("repostPost called - params:", req.params);
    const { id: postId } = req.params;
    const userId = req.user._id;
    console.log("Post ID:", postId, "User ID:", userId);

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user already reposted this post
    const existingRepost = await Repost.findOne({
      userId,
      originalPostId: postId,
      type: "repost",
    });

    if (existingRepost) {
      return res
        .status(409)
        .json({ error: "You have already reposted this post" });
    }

    // Create repost
    const repost = new Repost({
      userId,
      originalPostId: postId,
      type: "repost",
    });

    await repost.save();

    // Get repost count for the original post
    const repostCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "repost",
    });

    // Get quote count
    const quoteCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "quote",
    });

    // Check if current user has reposted
    const viewerReposted = true; // We just created it

    res.status(201).json({
      success: true,
      repostCount: repostCount + quoteCount, // Total reposts (simple + quotes)
      viewerState: {
        reposted: viewerReposted,
      },
    });
  } catch (error) {
    console.log("error in repostPost:", error.message);
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ error: "You have already reposted this post" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Quote repost (repost with comment)
export const quotePost = async (req, res) => {
  try {
    console.log("quotePost called - params:", req.params, "body:", req.body);
    const { id: postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;
    console.log("Post ID:", postId, "User ID:", userId, "Text:", text);

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Quote text is required" });
    }

    if (text.length > 500) {
      return res
        .status(400)
        .json({ error: "Quote text must be 500 characters or less" });
    }

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Create quote repost
    const quoteRepost = new Repost({
      userId,
      originalPostId: postId,
      type: "quote",
      quoteText: text.trim(),
    });

    await quoteRepost.save();

    // Get repost counts
    const repostCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "repost",
    });

    const quoteCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "quote",
    });

    // Get quote repost with populated user
    const quoteRepostPopulated = await Repost.findById(quoteRepost._id)
      .populate("userId", "username name profilePic")
      .lean();

    res.status(201).json({
      success: true,
      repostCount: repostCount + quoteCount,
      quoteRepost: quoteRepostPopulated,
    });
  } catch (error) {
    console.log("error in quotePost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Undo repost (remove repost)
export const undoRepost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user._id;

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Delete repost (both simple and quote)
    const deletedRepost = await Repost.findOneAndDelete({
      userId,
      originalPostId: postId,
      type: "repost",
    });

    if (!deletedRepost) {
      // Check if it's a quote repost
      const deletedQuote = await Repost.findOneAndDelete({
        userId,
        originalPostId: postId,
        type: "quote",
      });

      if (!deletedQuote) {
        return res.status(404).json({ error: "Repost not found" });
      }
    }

    // Get updated counts
    const repostCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "repost",
    });

    const quoteCount = await Repost.countDocuments({
      originalPostId: postId,
      type: "quote",
    });

    res.status(200).json({
      success: true,
      repostCount: repostCount + quoteCount,
      viewerState: {
        reposted: false,
      },
    });
  } catch (error) {
    console.log("error in undoRepost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Save / Unsave post (Instagram-style save)
export const saveUnsavePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const alreadySaved = user.savedPosts?.some(
      (pId) => pId.toString() === postId.toString()
    );

    if (alreadySaved) {
      // Unsave
      await User.updateOne({ _id: userId }, { $pull: { savedPosts: postId } });
      return res.status(200).json({
        success: true,
        saved: false,
        message: "Post removed from saved",
      });
    } else {
      // Save
      await User.updateOne(
        { _id: userId },
        { $addToSet: { savedPosts: postId } }
      );
      return res.status(200).json({
        success: true,
        saved: true,
        message: "Post saved successfully",
      });
    }
  } catch (error) {
    console.log("error in saveUnsavePost:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get current user's saved posts
export const getSavedPosts = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .populate({
        path: "savedPosts",
        populate: { path: "postedBy", select: "username name profilePic" },
      })
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const saved = (user.savedPosts || []).map((post) => {
      const postObj = post.toObject ? post.toObject() : post;
      return {
        ...postObj,
        video:
          postObj.video !== undefined && postObj.video !== null
            ? postObj.video
            : null,
        img:
          postObj.img !== undefined && postObj.img !== null
            ? postObj.img
            : null,
      };
    });

    return res.status(200).json({
      posts: saved,
      total: saved.length,
    });
  } catch (error) {
    console.log("error in getSavedPosts:", error.message);
    res.status(500).json({ error: error.message });
  }
};
