import Space from "../Models/spaceModel.js";
import Recording from "../Models/recordingModel.js";
import { v2 as cloudinary } from "cloudinary";
import { getRecipiantSocketId, io } from "../socket/socket.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for temporary file storage (dev only)
const upload = multer({
  dest: path.join(__dirname, "../uploads/recordings"),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/recordings");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create a new space
export const createSpace = async (req, res) => {
  try {
    const { title, description } = req.body;
    const hostId = req.user._id;

    const space = new Space({
      hostId,
      title: title || "",
      description: description || "",
      status: "scheduled",
      speakers: [hostId], // Host is automatically a speaker
      listeners: [],
    });

    await space.save();

    // Populate host info
    await space.populate("hostId", "username name profilePic");

    res.status(201).json(space);
  } catch (error) {
    console.error("Error in createSpace:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get space details
export const getSpace = async (req, res) => {
  try {
    const { id } = req.params;
    const space = await Space.findById(id)
      .populate("hostId", "username name profilePic")
      .populate("speakers", "username name profilePic")
      .populate("listeners", "username name profilePic");

    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    res.status(200).json(space);
  } catch (error) {
    console.error("Error in getSpace:", error);
    res.status(500).json({ error: error.message });
  }
};

// Start a space (go live)
export const startSpace = async (req, res) => {
  try {
    const space = req.space; // From checkSpaceHost middleware
    const userId = req.user._id;

    if (space.status !== "scheduled") {
      return res.status(400).json({
        error: "Space can only be started from scheduled status",
      });
    }

    space.status = "live";
    space.startedAt = new Date();
    await space.save();

    // Emit socket event
    io.emit("space:statusChanged", {
      spaceId: space._id,
      status: "live",
    });

    res.status(200).json(space);
  } catch (error) {
    console.error("Error in startSpace:", error);
    res.status(500).json({ error: error.message });
  }
};

// End a space
export const endSpace = async (req, res) => {
  try {
    const space = req.space;
    const userId = req.user._id;

    // Stop any active recording
    if (space.isRecording && space.activeRecordingId) {
      const recording = await Recording.findById(space.activeRecordingId);
      if (recording && recording.status === "recording") {
        recording.status = "processing";
        recording.endedAt = new Date();
        await recording.save();

        space.isRecording = false;
        space.activeRecordingId = null;
      }
    }

    space.status = "ended";
    space.endedAt = new Date();
    await space.save();

    // Emit socket event
    io.emit("space:statusChanged", {
      spaceId: space._id,
      status: "ended",
    });

    res.status(200).json(space);
  } catch (error) {
    console.error("Error in endSpace:", error);
    res.status(500).json({ error: error.message });
  }
};

// Start recording (host only)
export const startRecording = async (req, res) => {
  try {
    const space = req.space;
    const userId = req.user._id;

    // Validate space is live
    if (space.status !== "live") {
      return res.status(400).json({
        error: "Can only record when space is live",
      });
    }

    // Check if already recording
    if (space.isRecording) {
      return res.status(400).json({
        error: "Recording already in progress",
      });
    }

    // Create recording record
    const recording = new Recording({
      spaceId: space._id,
      hostId: userId,
      status: "recording",
      startedAt: new Date(),
    });

    await recording.save();

    // Update space
    space.isRecording = true;
    space.activeRecordingId = recording._id;
    await space.save();

    // Emit socket event to all space participants
    io.emit("space:recordingStatus", {
      spaceId: space._id,
      isRecording: true,
      recordingId: recording._id,
    });

    res.status(201).json({
      recordingId: recording._id,
      status: recording.status,
    });
  } catch (error) {
    console.error("Error in startRecording:", error);
    res.status(500).json({ error: error.message });
  }
};

// Stop recording (host only)
export const stopRecording = async (req, res) => {
  try {
    const space = req.space;
    const userId = req.user._id;

    if (!space.isRecording || !space.activeRecordingId) {
      return res.status(400).json({
        error: "No active recording to stop",
      });
    }

    const recording = await Recording.findById(space.activeRecordingId);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Update recording status - file will be uploaded separately
    recording.status = "processing";
    recording.endedAt = new Date();
    await recording.save();

    // Update space
    space.isRecording = false;
    const recordingId = space.activeRecordingId;
    space.activeRecordingId = null;
    await space.save();

    // Emit socket event
    io.emit("space:recordingStatus", {
      spaceId: space._id,
      isRecording: false,
      recordingId: recordingId,
    });

    res.status(200).json({
      recordingId: recording._id,
      status: recording.status,
    });
  } catch (error) {
    console.error("Error in stopRecording:", error);
    res.status(500).json({ error: error.message });
  }
};

// Upload recording file (host only, after stopping)
export const uploadRecording = async (req, res) => {
  try {
    const { id: spaceId, recordingId } = req.params;
    const userId = req.user._id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No recording file provided" });
    }

    const recording = await Recording.findById(recordingId);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Verify user is the host
    if (recording.hostId.toString() !== userId.toString()) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(403).json({
        error: "Only the space host can upload recordings",
      });
    }

    // Calculate duration if possible (basic estimate based on file size)
    // In production, you'd parse the audio file to get actual duration
    const estimatedDuration = Math.max(1, Math.floor(file.size / 16000)); // Rough estimate

    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: "video", // Cloudinary treats audio as video
        folder: "spaces/recordings",
        format: "webm",
        chunk_size: 6000000,
      });

      // Update recording with storage info
      recording.storage = {
        provider: "cloudinary",
        url: result.secure_url,
        key: result.public_id,
        sizeBytes: file.size,
        durationSec: estimatedDuration,
        mimeType: file.mimetype || "audio/webm",
      };
      recording.status = "ready";
      await recording.save();

      // Clean up local file
      fs.unlinkSync(file.path);

      res.status(200).json({
        recordingId: recording._id,
        status: recording.status,
        url: recording.storage.url,
      });
    } catch (cloudinaryError) {
      console.error("Cloudinary upload error:", cloudinaryError);

      // Fallback: store locally (dev only)
      const localUrl = `/api/spaces/recordings/${recording._id}/stream`;
      recording.storage = {
        provider: "local",
        url: localUrl,
        key: file.filename,
        sizeBytes: file.size,
        durationSec: estimatedDuration,
        mimeType: file.mimetype || "audio/webm",
      };
      recording.status = "ready";
      await recording.save();

      res.status(200).json({
        recordingId: recording._id,
        status: recording.status,
        url: recording.storage.url,
        warning: "Stored locally (dev mode)",
      });
    }
  } catch (error) {
    console.error("Error in uploadRecording:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

// Get recordings for a space (host only)
export const getSpaceRecordings = async (req, res) => {
  try {
    const space = req.space;
    const userId = req.user._id;

    const recordings = await Recording.find({
      spaceId: space._id,
      hostId: userId,
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({ recordings });
  } catch (error) {
    console.error("Error in getSpaceRecordings:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get recording details and signed URL (host only)
export const getRecording = async (req, res) => {
  try {
    const { rid: recordingId } = req.params;
    const userId = req.user._id;

    const recording = await Recording.findById(recordingId)
      .populate("spaceId", "title")
      .populate("hostId", "username name profilePic");

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Verify user is the host
    if (recording.hostId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        error: "Only the space host can access this recording",
      });
    }

    // If stored locally, provide streaming endpoint
    let accessUrl = recording.storage.url;
    if (recording.storage.provider === "local") {
      accessUrl = `/api/spaces/recordings/${recording._id}/stream`;
    }

    res.status(200).json({
      recording: {
        ...recording.toObject(),
        accessUrl,
      },
    });
  } catch (error) {
    console.error("Error in getRecording:", error);
    res.status(500).json({ error: error.message });
  }
};

// Stream recording file (host only, for local storage)
export const streamRecording = async (req, res) => {
  try {
    const { rid: recordingId } = req.params;
    const userId = req.user._id;

    const recording = await Recording.findById(recordingId);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Verify user is the host
    if (recording.hostId.toString() !== userId.toString()) {
      return res.status(403).json({
        error: "Only the space host can access this recording",
      });
    }

    if (recording.storage.provider !== "local") {
      return res.status(400).json({
        error: "Recording is not stored locally",
      });
    }

    const filePath = path.join(
      __dirname,
      "../uploads/recordings",
      recording.storage.key
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Recording file not found" });
    }

    // Set headers for audio streaming
    res.setHeader("Content-Type", recording.storage.mimeType || "audio/webm");
    res.setHeader("Content-Length", recording.storage.sizeBytes);
    res.setHeader("Accept-Ranges", "bytes");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error in streamRecording:", error);
    res.status(500).json({ error: error.message });
  }
};

// Join space as speaker
export const joinAsSpeaker = async (req, res) => {
  try {
    const { id: spaceId } = req.params;
    const userId = req.user._id;

    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    if (space.status !== "live") {
      return res.status(400).json({
        error: "Can only join live spaces",
      });
    }

    // Add to speakers if not already
    if (!space.speakers.includes(userId)) {
      space.speakers.push(userId);
      await space.save();
    }

    // Remove from listeners if present
    space.listeners = space.listeners.filter(
      (id) => id.toString() !== userId.toString()
    );
    await space.save();

    // Emit socket event
    io.emit("space:participantJoined", {
      spaceId: space._id,
      userId,
      role: "speaker",
    });

    res.status(200).json(space);
  } catch (error) {
    console.error("Error in joinAsSpeaker:", error);
    res.status(500).json({ error: error.message });
  }
};

// Join space as listener
export const joinAsListener = async (req, res) => {
  try {
    const { id: spaceId } = req.params;
    const userId = req.user._id;

    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    if (space.status !== "live") {
      return res.status(400).json({
        error: "Can only join live spaces",
      });
    }

    // Add to listeners if not already
    if (!space.listeners.includes(userId)) {
      space.listeners.push(userId);
      await space.save();
    }

    // Remove from speakers if present (unless host)
    if (space.hostId.toString() !== userId.toString()) {
      space.speakers = space.speakers.filter(
        (id) => id.toString() !== userId.toString()
      );
      await space.save();
    }

    // Emit socket event
    io.emit("space:participantJoined", {
      spaceId: space._id,
      userId,
      role: "listener",
    });

    res.status(200).json(space);
  } catch (error) {
    console.error("Error in joinAsListener:", error);
    res.status(500).json({ error: error.message });
  }
};

// Leave space
export const leaveSpace = async (req, res) => {
  try {
    const { id: spaceId } = req.params;
    const userId = req.user._id;

    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    // Remove from speakers and listeners
    space.speakers = space.speakers.filter(
      (id) => id.toString() !== userId.toString()
    );
    space.listeners = space.listeners.filter(
      (id) => id.toString() !== userId.toString()
    );
    await space.save();

    // Emit socket event
    io.emit("space:participantLeft", {
      spaceId: space._id,
      userId,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in leaveSpace:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all live spaces
export const getLiveSpaces = async (req, res) => {
  try {
    const spaces = await Space.find({ status: "live" })
      .populate("hostId", "username name profilePic")
      .sort({ startedAt: -1 })
      .limit(50);

    res.status(200).json({ spaces });
  } catch (error) {
    console.error("Error in getLiveSpaces:", error);
    res.status(500).json({ error: error.message });
  }
};
