# GridFS Video Upload Implementation Summary

## 📦 Required Packages

Install these packages:
```bash
npm install multer multer-gridfs-storage gridfs-stream
```

## 📝 Exact Code Changes

### 1. Post Model (`backend/Models/postModel.js`)

**Lines 18-21: ADD these fields after `video` field:**
```javascript
videoFileId: {
  type: mongoose.Schema.Types.ObjectId,
  default: null,
},
hasVideo: {
  type: Boolean,
  default: false,
},
```

### 2. Create Multer Middleware (`backend/middleware/uploadVideo.js`)

**NEW FILE - Create this file:**
```javascript
import multer from "multer";
import mongoose from "mongoose";
import Grid from "gridfs-stream";
import { GridFSStorage } from "multer-gridfs-storage";

let gfs;

// Initialize GridFS
const initGridFS = () => {
  if (mongoose.connection.readyState === 1) {
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection("videos");
  }
};

// Create GridFS storage engine
const storage = new GridFSStorage({
  db: mongoose.connection,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `video_${Date.now()}_${file.originalname}`;
      const fileInfo = {
        filename: filename,
        bucketName: "videos",
        metadata: {
          uploadedBy: req.user?._id?.toString(),
          uploadedAt: new Date(),
        },
      };
      resolve(fileInfo);
    });
  },
});

// Configure multer
export const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});
```

### 3. Create Video Controller (`backend/controllers/videoController.js`)

**NEW FILE - Create this file:**
```javascript
import mongoose from "mongoose";
import Grid from "gridfs-stream";

let gfs;

// Initialize GridFS
const initGridFS = () => {
  if (mongoose.connection.readyState === 1) {
    const conn = mongoose.connection;
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("videos");
    return gfs;
  }
  return null;
};

// Get GridFS instance
const getGridFS = () => {
  if (!gfs) {
    return initGridFS();
  }
  return gfs;
};

// Stream video from GridFS
export const streamVideo = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    const gfsInstance = getGridFS();

    // Find file in GridFS
    gfsInstance.files.findOne({ _id: new mongoose.Types.ObjectId(fileId) }, (err, file) => {
      if (err) {
        console.error("Error finding file:", err);
        return res.status(500).json({ error: "Error finding file" });
      }

      if (!file) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Set appropriate headers for video streaming
      res.set("Content-Type", file.contentType || "video/mp4");
      res.set("Content-Length", file.length);
      res.set("Accept-Ranges", "bytes");

      // Handle range requests for video seeking
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
        const chunksize = end - start + 1;

        res.status(206); // Partial Content
        res.set({
          "Content-Range": `bytes ${start}-${end}/${file.length}`,
          "Content-Length": chunksize,
        });

        const readStream = gfsInstance.createReadStream({
          _id: file._id,
          range: { start, end },
        });

        readStream.pipe(res);
      } else {
        // Stream entire file
        const readStream = gfsInstance.createReadStream({ _id: file._id });
        readStream.pipe(res);
      }
    });
  } catch (error) {
    console.error("Error streaming video:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};
```

### 4. Update Post Routes (`backend/routes/postRoutes.js`)

**Line 1: ADD imports:**
```javascript
import { uploadVideo } from "../middleware/uploadVideo.js"
import { streamVideo } from "../controllers/videoController.js"
```

**Line 10: MODIFY create route:**
```javascript
postRoutes.post("/create",protectRoute,uploadVideo.single("video"),createPost)
```

**ADD new route after line 11:**
```javascript
postRoutes.get("/video/:fileId",streamVideo)
```

### 5. Update Post Controller (`backend/controllers/postController.js`)

**Line 40: ADD after `let { img, video } = req.body;`:**
```javascript
// Check if video file was uploaded via multipart/form-data (GridFS)
const videoFile = req.file;
```

**Lines 80-93: REPLACE validation section:**
```javascript
// Validate media inputs (only one type allowed)
// Check for GridFS video file first (multipart/form-data)
const hasVideoFile = videoFile && videoFile.id;
const hasVideoInput =
  !hasVideoFile && // Only check base64 if no file upload
  video &&
  typeof video === "string" &&
  video.trim() !== "" &&
  video !== "null";
const hasImgInput =
  img && typeof img === "string" && img.trim() !== "" && img !== "null";

if ((hasVideoFile || hasVideoInput) && hasImgInput) {
  return res.status(400).json({
    error: "Cannot upload both image and video in the same post",
  });
}
```

**Lines 258-265: REPLACE video handling:**
```javascript
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
}
```

**Lines 266-270: UPDATE img handling:**
```javascript
} else if (isImgValid) {
  postData.img = img;
  postData.video = null; // Explicitly set video to null when img is set
  postData.videoFileId = null;
  postData.hasVideo = false;
  console.log("✅ IMG SET in postData:", img.substring(0, 50) + "...");
```

**Lines 272-277: UPDATE else block:**
```javascript
} else {
  // Neither img nor video - set both to null explicitly
  postData.img = null;
  postData.video = null;
  postData.videoFileId = null;
  postData.hasVideo = false;
  console.log("⚠️ Neither img nor video - both set to null");
```

**Lines 387-399: UPDATE force update section:**
```javascript
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
```

**Lines 425-450: UPDATE response preparation:**
```javascript
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
```

### 6. Update Database Connection (`backend/DB/database.js`)

**Lines 20-23: ADD after connection success:**
```javascript
console.log(
  `✅ MongoDB connected successfully: ${connect.connection.host}`
);
console.log(`📊 Database: ${connect.connection.name}`);

// Initialize GridFS for video storage
const Grid = (await import("gridfs-stream")).default;
const gfs = Grid(connect.connection.db, mongoose.mongo);
gfs.collection("videos");
console.log(`✅ GridFS initialized for video storage`);
```

## 📤 Request/Response Examples

### Request (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('postedBy', 'user_id_here');
formData.append('text', 'My post with video');
formData.append('video', videoFile); // File object from <input type="file">

fetch('/api/posts/create', {
  method: 'POST',
  headers: {
    // Don't set Content-Type - browser sets it with boundary
  },
  body: formData
});
```

### Response:
```json
{
  "_id": "69445ab8b79b44bbe219883c",
  "postedBy": "69442f2db79b44bbe2198393",
  "text": "My post with video",
  "img": null,
  "video": null,
  "videoFileId": "507f1f77bcf86cd799439011",
  "hasVideo": true,
  "likes": [],
  "replies": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Video Streaming:
```html
<video controls>
  <source src="/api/posts/video/507f1f77bcf86cd799439011" type="video/mp4" />
</video>
```

## ✅ Summary

- ✅ GridFS video storage implemented
- ✅ Only `videoFileId` and `hasVideo` stored in Post model
- ✅ Multer + GridFS for uploads
- ✅ multipart/form-data support
- ✅ Video streaming endpoint added
- ✅ Minimal changes to existing code
- ✅ Backward compatible (Cloudinary videos still work)
- ✅ Image uploads unchanged

