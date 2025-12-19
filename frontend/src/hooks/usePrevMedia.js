import { useState } from "react";
import toast from "react-hot-toast";

// Constants for file validation
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB for posts
const MAX_VIDEO_SIZE_CHAT = 25 * 1024 * 1024; // 25MB for chat messages
const MAX_VIDEO_DURATION_CHAT = 60; // 60 seconds max for chat videos

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // MOV
  "video/x-msvideo", // AVI
  "video/3gpp", // 3GP format
  "video/3gp", // Alternative 3GP MIME type
];

const usePrevMedia = (isChat = false) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [isProcessing, setIsProcessing] = useState(false);

  const validateVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;

        if (isChat && duration > MAX_VIDEO_DURATION_CHAT) {
          reject(
            new Error(
              `Video duration must be less than ${MAX_VIDEO_DURATION_CHAT} seconds for chat messages`
            )
          );
        } else {
          resolve(duration);
        }
      };

      video.onerror = () => {
        reject(new Error("Failed to load video metadata"));
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleMediaChange = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      setImageUrl(null);
      setVideoUrl(null);
      setMediaType(null);
      return;
    }

    setIsProcessing(true);

    try {
      // Check if it's an image
      if (file.type.startsWith("image/")) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          throw new Error(
            `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
          );
        }

        if (file.size > MAX_IMAGE_SIZE) {
          throw new Error(
            `Image size must be less than ${(
              MAX_IMAGE_SIZE /
              1024 /
              1024
            ).toFixed(0)}MB`
          );
        }

        const reader = new FileReader();
        reader.onload = () => {
          setImageUrl(reader.result);
          setVideoUrl(null);
          setMediaType("image");
          setIsProcessing(false);
        };
        reader.onerror = () => {
          throw new Error("Failed to read image file");
        };
        reader.readAsDataURL(file);
      }
      // Check if it's a video
      else if (file.type.startsWith("video/")) {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          throw new Error(
            `Invalid video type. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`
          );
        }

        const maxSize = isChat ? MAX_VIDEO_SIZE_CHAT : MAX_VIDEO_SIZE;
        if (file.size > maxSize) {
          throw new Error(
            `Video size must be less than ${(maxSize / 1024 / 1024).toFixed(
              0
            )}MB`
          );
        }

        // Validate video duration for chat
        if (isChat) {
          await validateVideoDuration(file);
        }

        const reader = new FileReader();
        reader.onload = () => {
          setVideoUrl(reader.result);
          setImageUrl(null);
          setMediaType("video");
          setIsProcessing(false);
        };
        reader.onerror = () => {
          throw new Error("Failed to read video file");
        };
        reader.readAsDataURL(file);
      } else {
        throw new Error(
          "Invalid file type. Please select an image or video file"
        );
      }
    } catch (error) {
      toast.error(error.message || "Failed to process file");
      setImageUrl(null);
      setVideoUrl(null);
      setMediaType(null);
      setIsProcessing(false);
    }
  };

  const resetMedia = () => {
    setImageUrl(null);
    setVideoUrl(null);
    setMediaType(null);
  };

  return {
    handleMediaChange,
    imageUrl,
    videoUrl,
    mediaType,
    isProcessing,
    setImageUrl,
    setVideoUrl,
    resetMedia,
  };
};

export default usePrevMedia;
