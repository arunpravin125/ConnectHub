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
    gfsInstance.files.findOne(
      { _id: new mongoose.Types.ObjectId(fileId) },
      (err, file) => {
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
      }
    );
  } catch (error) {
    console.error("Error streaming video:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};
