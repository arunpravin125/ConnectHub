import mongoose from "mongoose";

const postSchema = mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      maxLength: 500,
    },
    img: {
      type: String,
      default: null, // Explicitly set default to null so field is always present
    },
    video: {
      type: String,
      default: null, // Explicitly set default to null so field is always present
    },
    videoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    hasVideo: {
      type: Boolean,
      default: false,
    },
    likes: {
      // array of user ids|| [if likes added by number of userId count]
      type: [mongoose.Schema.Types.ObjectId], // likes and unlike according user id push and push method
      ref: "User",
      default: [],
    },
    replies: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        userProfilePic: {
          type: String,
        },
        username: {
          type: String,
        },
      },
    ],
    // Breaking news fields
    isBreaking: {
      type: Boolean,
      default: false,
    },
    headline: {
      type: String,
      default: null,
    },
    sourceName: {
      type: String,
      default: null,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    breakingExpiresAt: {
      type: Date,
      default: null,
    },
    newsExternalId: {
      type: String,
      default: null,
      sparse: true, // Allows multiple nulls but enforces uniqueness for non-null values
    },
    newsPublishedAt: {
      type: Date,
      default: null,
    },
    createdBySystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index to prevent duplicate news items
postSchema.index({ newsExternalId: 1 }, { unique: true, sparse: true });

// Index for efficient breaking news queries
postSchema.index({ isBreaking: 1, breakingExpiresAt: 1 });
postSchema.index({ newsPublishedAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
