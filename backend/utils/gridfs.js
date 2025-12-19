import mongoose from "mongoose";
import Grid from "gridfs-stream";

let gfs;

// Initialize GridFS
export const initGridFS = () => {
  const conn = mongoose.connection;
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("videos");
  return gfs;
};

// Get GridFS instance
export const getGridFS = () => {
  if (!gfs) {
    return initGridFS();
  }
  return gfs;
};

// Upload video to GridFS
export const uploadVideoToGridFS = (fileStream, filename, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const writeStream = getGridFS().createWriteStream({
      filename: filename,
      mode: "w",
      content_type: "video/mp4",
      metadata: metadata,
    });

    fileStream.pipe(writeStream);

    writeStream.on("close", (file) => {
      resolve(file._id);
    });

    writeStream.on("error", (error) => {
      reject(error);
    });
  });
};

// Download video from GridFS
export const downloadVideoFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new Error("Invalid file ID"));
    }

    const readStream = getGridFS().createReadStream({
      _id: fileId,
    });

    readStream.on("error", (error) => {
      reject(error);
    });

    resolve(readStream);
  });
};

// Get file info from GridFS
export const getVideoInfo = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new Error("Invalid file ID"));
    }

    getGridFS().files.findOne({ _id: fileId }, (err, file) => {
      if (err) return reject(err);
      if (!file) return reject(new Error("File not found"));
      resolve(file);
    });
  });
};

// Delete video from GridFS
export const deleteVideoFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new Error("Invalid file ID"));
    }

    getGridFS().remove({ _id: fileId }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};
