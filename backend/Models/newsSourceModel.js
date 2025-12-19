import mongoose from "mongoose";

const newsSourceSchema = mongoose.Schema(
  {
    feedUrl: {
      type: String,
      required: true,
      unique: true,
    },
    sourceName: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastFetchedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for active feeds
newsSourceSchema.index({ isActive: 1 });

const NewsSource = mongoose.model("NewsSource", newsSourceSchema);

export default NewsSource;
