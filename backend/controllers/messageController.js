import Conversation from "../Models/conversationModel.js";
import Message from "../Models/messageModel.js";
import { v2 as cloudinary } from "cloudinary";
import { getRecipiantSocketId, io } from "../socket/socket.js";

export const sendMessage = async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    let { img, video } = req.body;
    const senderId = req.user._id;
    
    // Check if file was uploaded via multipart/form-data
    const uploadedFile = req.file;
    
    console.log("sendMessage called - File:", uploadedFile ? `${uploadedFile.originalname} (${uploadedFile.size} bytes)` : "none");

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          text: message,
          sender: senderId,
        },
      });
      await conversation.save();
    }

    // Handle file upload (PDF, DOC, DOCX, Audio) via multipart/form-data
    let fileUrl = "";
    let fileName = "";
    let fileType = "";
    let audio = "";
    
    if (uploadedFile) {
      try {
        let fileMimeType = uploadedFile.mimetype;
        
        // Handle cases where MIME type might not be set correctly
        if (!fileMimeType || fileMimeType === "application/octet-stream") {
          // Try to detect from filename
          const fileName = uploadedFile.originalname.toLowerCase();
          if (fileName.endsWith(".webm") || fileName.endsWith(".ogg") || fileName.endsWith(".wav") || fileName.endsWith(".mp3") || fileName.endsWith(".m4a")) {
            fileMimeType = "audio/webm"; // Default to webm for MediaRecorder
            console.log("Detected audio file from filename:", fileName);
          } else if (fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".avi")) {
            fileMimeType = "video/mp4";
          } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
            fileMimeType = "image/jpeg";
          }
        }
        
        console.log("File upload detected. MIME type:", fileMimeType, "Size:", uploadedFile.size, "bytes");
        
        // Validate file size
        if (!uploadedFile.size || uploadedFile.size === 0) {
          return res.status(400).json({
            error: "Empty file uploaded",
          });
        }
        
        if (uploadedFile.size > 20 * 1024 * 1024) {
          return res.status(400).json({
            error: "File size exceeds 20MB limit",
          });
        }
        
        let resourceType = "raw"; // Default for documents
        
        // Determine resource type based on file type
        if (fileMimeType.startsWith("image/")) {
          resourceType = "image";
        } else if (fileMimeType.startsWith("video/")) {
          resourceType = "video";
        } else if (fileMimeType.startsWith("audio/") || fileMimeType.includes("webm") || fileMimeType.includes("audio")) {
          resourceType = "video"; // Cloudinary uses "video" resource type for audio files
        } else {
          resourceType = "raw"; // For PDF, DOC, DOCX
        }
        
        // Convert buffer to base64 for Cloudinary
        // For large files, use stream upload instead of base64 to avoid memory issues
        let dataURI;
        if (uploadedFile.size > 5 * 1024 * 1024) {
          // For files larger than 5MB, use buffer directly with Cloudinary's upload_stream
          console.log(`Large file detected (${uploadedFile.size} bytes), using stream upload...`);
          // We'll use the buffer directly in upload_stream
          dataURI = null; // Signal to use stream upload
        } else {
          // For smaller files, use base64
          const base64File = uploadedFile.buffer.toString("base64");
          dataURI = `data:${fileMimeType};base64,${base64File}`;
        }
        
        console.log(`Uploading ${fileMimeType} file to Cloudinary... (Size: ${uploadedFile.size} bytes)`);
        
        // Configure upload options based on file type
        const uploadOptions = {
          resource_type: resourceType,
          folder: resourceType === "image" 
            ? "threads/messages/images"
            : resourceType === "video"
            ? (fileMimeType.startsWith("audio/") || fileMimeType.includes("webm") || fileMimeType.includes("audio") ? "threads/messages/audio" : "threads/messages/videos")
            : "threads/messages/files",
          timeout: 300000, // 5 minutes timeout for large files
        };
        
        // Add transformations based on resource type
        if (resourceType === "image") {
          uploadOptions.transformation = [
            { width: 800, height: 800, crop: "limit", quality: "auto" },
          ];
        } else if (resourceType === "video") {
          if (fileMimeType.startsWith("audio/") || fileMimeType.includes("webm") || fileMimeType.includes("audio")) {
            // Audio file - upload as-is without transformation to avoid processing delays
            // WebM audio is widely supported by browsers, no need to convert
            uploadOptions.chunk_size = 6000000; // 6MB chunks for better reliability
            // Don't add transformation - let Cloudinary serve the file as-is
          } else {
            // Video file
            uploadOptions.transformation = [
              {
                video_codec: "h264",
                audio_codec: "aac",
                format: "mp4",
                quality: "auto:good",
                max_video_duration: 60,
              },
            ];
            uploadOptions.chunk_size = 6000000; // 6MB chunks
          }
        }
        
        let uploadedResponse;
        
        if (dataURI) {
          // Use base64 upload for smaller files
          uploadedResponse = await cloudinary.uploader.upload(dataURI, uploadOptions);
        } else {
          // Use stream upload for larger files
          uploadedResponse = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              uploadOptions,
              (error, result) => {
                if (error) {
                  console.error("Cloudinary stream upload error:", error);
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            );
            uploadStream.end(uploadedFile.buffer);
          });
        }
        
        fileName = uploadedFile.originalname;
        fileType = fileMimeType;
        
        // Set img, video, or audio based on file type
        // Only set fileUrl for document files (PDF, DOC, DOCX), not for media files
        if (resourceType === "image") {
          img = uploadedResponse.secure_url;
          // Don't set fileUrl for images - use img field instead
        } else if (resourceType === "video") {
          if (fileMimeType.startsWith("audio/") || fileMimeType.includes("webm") || fileMimeType.includes("audio") || uploadedFile.originalname.toLowerCase().includes("audio")) {
            audio = uploadedResponse.secure_url;
            console.log("Audio file detected and uploaded:", audio);
            // Don't set fileUrl for audio - use audio field instead
          } else {
            video = uploadedResponse.secure_url;
            // Don't set fileUrl for videos - use video field instead
          }
        } else {
          // For document files (PDF, DOC, DOCX), set fileUrl
          fileUrl = uploadedResponse.secure_url;
        }
        
        console.log(`File uploaded successfully: ${fileName}`);
      } catch (cloudinaryError) {
        console.error("Cloudinary file upload error:", cloudinaryError);
        console.error("Error details:", {
          message: cloudinaryError.message,
          http_code: cloudinaryError.http_code,
          name: cloudinaryError.name,
          fileType: fileMimeType,
          fileSize: uploadedFile.size,
        });
        return res.status(500).json({
          error: "Failed to upload file to Cloudinary",
          details: cloudinaryError.message || "Unknown error occurred during upload",
        });
      }
    }

    // Handle image upload (base64 - legacy support)
    if (img && !fileUrl) {
      const uploadedRespnse = await cloudinary.uploader.upload(img, {
        resource_type: "image",
        folder: "threads/messages/images",
        transformation: [
          { width: 800, height: 800, crop: "limit", quality: "auto" },
        ],
      });
      img = uploadedRespnse.secure_url;
    }

    // Handle video upload with best practices for chat - Force MP4 format (supports MP4, 3GP, etc.)
    if (video) {
      try {
        console.log("Uploading chat video to Cloudinary...");
        const uploadedRespnse = await cloudinary.uploader.upload(video, {
          resource_type: "video",
          folder: "threads/messages/videos",
          // Accept ANY video format - Cloudinary will auto-detect the input format
          // No format restriction - supports: MP4, 3GP, MOV, AVI, WebM, MKV, FLV, WMV, and more
          chunk_size: 6000000, // 6MB chunks
          eager: [
            // Generate thumbnail for video preview in chat
            { width: 200, height: 200, crop: "fill", format: "jpg" },
          ],
          eager_async: true,
          transformation: [
            {
              video_codec: "h264", // H.264 codec for MP4 (widely supported)
              audio_codec: "aac", // AAC audio codec (widely supported)
              format: "mp4", // Convert to MP4 format (works for ANY input format)
              quality: "auto:good",
              // Limit video size for chat (shorter videos)
              max_video_duration: 60, // 60 seconds max for chat videos
            },
          ],
          // No allowed_formats restriction - accepts any video format Cloudinary supports
        });
        video = uploadedRespnse.secure_url;

        // Validate video URL is from Cloudinary
        if (!video || video.trim() === "") {
          throw new Error("Cloudinary returned empty video URL");
        }

        if (
          !video.includes("res.cloudinary.com") ||
          !video.includes("/video/upload/")
        ) {
          console.error("❌ Invalid chat video URL:", video.substring(0, 100));
          throw new Error(
            "Video URL must be from Cloudinary. Only Cloudinary URLs are allowed."
          );
        }

        console.log(
          "Chat video uploaded successfully to Cloudinary:",
          uploadedRespnse.public_id
        );
      } catch (cloudinaryError) {
        console.error("Cloudinary chat video upload error:", cloudinaryError);
        return res.status(500).json({
          error: "Failed to upload video to Cloudinary",
          details: cloudinaryError.message,
        });
      }
    }

    // Ensure only one media type per message
    if ((img && video) || (img && audio) || (video && audio)) {
      return res.status(400).json({
        error: "Cannot upload multiple media types in the same message",
      });
    }
    
    // Ensure file is not sent with other media
    if (fileUrl && (img || video || audio)) {
      return res.status(400).json({
        error: "Cannot upload file with image, video, or audio in the same message",
      });
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text: message,
      img: img || "",
      video: video || "",
      audio: audio || "",
      fileUrl: fileUrl || "",
      fileName: fileName || "",
      fileType: fileType || "",
    });

    await Promise.all([
      newMessage.save(),
      conversation.updateOne({
        lastMessage: {
          text: message || (img ? "📷 Image" : video ? "🎥 Video" : audio ? "🎤 Audio" : fileUrl ? `📎 ${fileName}` : ""),
          sender: senderId,
        },
      }),
    ]);

    // Emit to recipient
    const recipientSocketId = getRecipiantSocketId(recipientId);
    if (recipientSocketId) {
      console.log(`📤 Emitting newMessage to recipient ${recipientId} (socket: ${recipientSocketId})`);
      io.to(recipientSocketId).emit("newMessage", newMessage);
    } else {
      console.warn(`⚠️ Recipient ${recipientId} not connected (socket not found)`);
    }

    // Also emit to sender so they see the message immediately and conversation list updates
    const senderSocketId = getRecipiantSocketId(senderId);
    if (senderSocketId) {
      console.log(`📤 Emitting newMessage to sender ${senderId} (socket: ${senderSocketId})`);
      io.to(senderSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: error.message || "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};

export const getMessages = async (req, res) => {
  const { otherUserId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user._id;
  
  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
    });

    if (!conversation) {
      return res.status(404).json({ error: "no conversation found" });
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 20); // Max 20 messages per page
    const skip = (pageNum - 1) * limitNum;

    // Build query: exclude messages deleted for this user
    const messageQuery = {
      conversationId: conversation._id,
      deletedForUsers: { $ne: userId }, // Exclude messages deleted for this user
    };

    // Get total count for pagination info (excluding deleted-for-me messages)
    const totalMessages = await Message.countDocuments(messageQuery);

    // Get messages with pagination (newest first, then reverse for display)
    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 }) // Newest first
      .limit(limitNum)
      .skip(skip)
      .lean(); // Use lean() for plain objects

    // Process messages: handle delete-for-everyone tombstone
    const processedMessages = messages.map((msg) => {
      if (msg.deletedForAll) {
        // Return tombstone payload
        return {
          ...msg,
          type: "tombstone",
          text: null,
          img: "",
          video: "",
          audio: "",
          fileUrl: "",
          fileName: "",
          fileType: "",
          tombstoneText: "This message was deleted",
        };
      }
      return msg;
    });

    // Reverse to show oldest to newest in chat
    const reversedMessages = processedMessages.reverse();

    res.status(200).json({
      messages: reversedMessages,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalMessages / limitNum),
        totalMessages,
        hasMore: skip + limitNum < totalMessages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error.message);
  }
};

// Delete for me - removes message only for the requesting user
export const deleteForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is a participant in the conversation
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Add user to deletedForUsers array (idempotent with $addToSet)
    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { deletedForUsers: userId } }
    );

    // Emit socket event only to requester
    const requesterSocketId = getRecipiantSocketId(userId);
    if (requesterSocketId) {
      io.to(requesterSocketId).emit("message:deleted_for_me", {
        messageId,
        conversationId: message.conversationId,
      });
    }

    res.status(200).json({
      success: true,
      messageId,
      message: "Message deleted for you",
    });
  } catch (error) {
    console.error("Error in deleteForMe:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Delete for everyone - removes message for both participants (sender only, within 48h)
export const deleteForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify requester is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        error: "Only the message sender can delete for everyone",
      });
    }

    // Check if already deleted for everyone
    if (message.deletedForAll) {
      return res.status(400).json({
        error: "Message already deleted for everyone",
      });
    }

    // Verify time window (48 hours = 2 days)
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const hours48 = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    if (messageAge > hours48) {
      return res.status(400).json({
        error: "Cannot delete message. Time limit of 48 hours has passed",
      });
    }

    // Update message: set deletedForAll flag and clear content (tombstone)
    await Message.updateOne(
      { _id: messageId },
      {
        $set: {
          deletedForAll: true,
          deletedForAllAt: new Date(),
          text: "",
          img: "",
          video: "",
          audio: "",
          fileUrl: "",
          fileName: "",
          fileType: "",
        },
      }
    );

    const updatedMessage = await Message.findById(messageId);

    // Emit socket event to both participants
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation && conversation.participants) {
      conversation.participants.forEach((participantId) => {
        const participantSocketId = getRecipiantSocketId(participantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit("message:deleted_for_all", {
            messageId,
            conversationId: message.conversationId,
            deletedForAll: true,
            tombstoneText: "This message was deleted",
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      messageId,
      message: updatedMessage,
      tombstoneText: "This message was deleted",
    });
  } catch (error) {
    console.error("Error in deleteForEveryone:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const getConversation = async (req, res) => {
  const userId = req.user._id;
  try {
    let conversation = await Conversation.find({
      participants: userId,
    }).populate({
      path: "participants",
      select: "username profilePic",
    });

    conversation.forEach((conversation) => {
      conversation.participants = conversation.participants.filter(
        (participants) => participants._id.toString() !== userId.toString()
      );
    });

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error });
    console.log(error.message);
  }
};
