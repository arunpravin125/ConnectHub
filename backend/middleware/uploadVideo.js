import multer from "multer";
import mongoose from "mongoose";
import Grid from "gridfs-stream";
import { createRequire } from "module";

// multer-gridfs-storage is CommonJS, so use require()
const require = createRequire(import.meta.url);
const { GridFsStorage } = require("multer-gridfs-storage");

let gfs;

// Initialize GridFS
const initGridFS = () => {
  if (mongoose.connection.readyState === 1) {
    gfs = Grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection("videos");
  }
};

// Create GridFS storage engine
const storage = new GridFsStorage({
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
