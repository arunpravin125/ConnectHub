import mongoose from "mongoose";

const repostSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    type: {
      type: String,
      enum: ["repost", "quote"],
      required: true,
    },
    quoteText: {
      type: String,
      maxLength: 500,
      default: null,
    },
    // For quote reposts, store the quote post ID if it's created as a separate Post
    quotePostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one user can only repost (not quote) the same post once
// But can quote the same post multiple times with different text
repostSchema.index({ userId: 1, originalPostId: 1, type: 1 }, { unique: true });

// Index for efficient feed queries
repostSchema.index({ userId: 1, createdAt: -1 });
repostSchema.index({ originalPostId: 1 });

const Repost = mongoose.model("Repost", repostSchema);

export default Repost;

