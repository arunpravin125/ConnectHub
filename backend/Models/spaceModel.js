import mongoose from "mongoose";

const spaceSchema = mongoose.Schema(
  {
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      maxLength: 200,
      default: "",
    },
    description: {
      type: String,
      maxLength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
    speakers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    listeners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isRecording: {
      type: Boolean,
      default: false,
    },
    activeRecordingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recording",
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
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

// Index for efficient queries
spaceSchema.index({ hostId: 1, status: 1 });
spaceSchema.index({ status: 1, createdAt: -1 });

const Space = mongoose.model("Space", spaceSchema);

export default Space;
