import mongoose from "mongoose";

const recordingSchema = mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["recording", "processing", "ready", "failed"],
      default: "recording",
    },
    storage: {
      provider: {
        type: String,
        enum: ["cloudinary", "local", "s3"],
        default: "cloudinary",
      },
      url: {
        type: String,
        default: null,
      },
      key: {
        type: String,
        default: null,
      },
      sizeBytes: {
        type: Number,
        default: 0,
      },
      durationSec: {
        type: Number,
        default: 0,
      },
      mimeType: {
        type: String,
        default: "audio/webm",
      },
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
recordingSchema.index({ spaceId: 1, status: 1 });
recordingSchema.index({ hostId: 1, createdAt: -1 });
recordingSchema.index({ status: 1 });

const Recording = mongoose.model("Recording", recordingSchema);

export default Recording;
