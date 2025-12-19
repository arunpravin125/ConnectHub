import Parser from "rss-parser";
import Post from "../Models/postModel.js";
import NewsSource from "../Models/newsSourceModel.js";
import User from "../Models/userModel.js";
import crypto from "crypto";
import pLimit from "p-limit";

const parser = new Parser({
  timeout: 10000, // 10 second timeout
  customFields: {
    item: ["description", "content:encoded", "content", "pubDate"],
  },
});

// Limit concurrent feed fetches to avoid hammering servers
const limit = pLimit(3);

/**
 * Generate unique external ID for a news item
 */
const generateNewsExternalId = (feedUrl, itemGuid, itemLink) => {
  const uniqueString = `${feedUrl}|${itemGuid || itemLink}`;
  return crypto.createHash("sha256").update(uniqueString).digest("hex");
};

/**
 * Extract short summary from item description
 */
const extractSummary = (description, maxLength = 240) => {
  if (!description) return null;

  // Remove HTML tags
  const textOnly = description
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (textOnly.length <= maxLength) return textOnly;
  return textOnly.substring(0, maxLength - 3) + "...";
};

/**
 * Get or create system user for breaking news posts
 */
const getSystemUser = async () => {
  // Try to find existing system user
  let systemUser = await User.findOne({ username: "__system__" });

  if (!systemUser) {
    // Create system user if it doesn't exist
    // Use bcrypt to hash password (required by User model)
    const bcrypt = (await import("bcryptjs")).default;
    const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    
    systemUser = new User({
      name: "Breaking News",
      username: "__system__",
      email: `system_${Date.now()}@news.local`,
      password: hashedPassword,
      profilePic: "",
      bio: "Automated breaking news updates",
      isFrozen: false,
    });
    await systemUser.save();
    console.log("✅ Created system user for breaking news");
  }

  return systemUser;
};

/**
 * Fetch and parse a single RSS feed
 */
const fetchFeed = async (source) => {
  try {
    console.log(`📡 Fetching feed: ${source.sourceName} (${source.feedUrl})`);

    const feed = await parser.parseURL(source.feedUrl);

    if (!feed || !feed.items || feed.items.length === 0) {
      console.log(`⚠️ No items found in feed: ${source.sourceName}`);
      return { source, items: [], error: null };
    }

    console.log(`✅ Fetched ${feed.items.length} items from ${source.sourceName}`);

    // Update last fetched timestamp
    await NewsSource.findByIdAndUpdate(source._id, {
      lastFetchedAt: new Date(),
      errorCount: 0,
      lastError: null,
    });

    return { source, items: feed.items, error: null };
  } catch (error) {
    console.error(`❌ Error fetching feed ${source.sourceName}:`, error.message);

    // Update error count
    const errorCount = (source.errorCount || 0) + 1;
    await NewsSource.findByIdAndUpdate(source._id, {
      lastFetchedAt: new Date(),
      errorCount,
      lastError: error.message.substring(0, 200), // Limit error message length
    });

    // If too many errors, deactivate feed
    if (errorCount >= 5) {
      await NewsSource.findByIdAndUpdate(source._id, {
        isActive: false,
      });
      console.log(`⚠️ Deactivated feed ${source.sourceName} due to repeated errors`);
    }

    return { source, items: [], error: error.message };
  }
};

/**
 * Process a single news item and upsert into database
 */
const processNewsItem = async (item, source, systemUserId) => {
  try {
    const itemGuid = item.guid || item.id || item.link;
    const itemLink = item.link || item.guid || item.id;

    if (!itemLink) {
      console.warn("⚠️ Skipping item without link/guid:", item.title);
      return null;
    }

    const newsExternalId = generateNewsExternalId(source.feedUrl, itemGuid, itemLink);
    const headline = item.title || "Untitled";
    const summary = extractSummary(item.description || item.content || item["content:encoded"]);

    // Parse published date
    let newsPublishedAt = new Date();
    if (item.pubDate) {
      const parsedDate = new Date(item.pubDate);
      if (!isNaN(parsedDate.getTime())) {
        newsPublishedAt = parsedDate;
      }
    }

    // Check if post already exists
    const existingPost = await Post.findOne({ newsExternalId });

    if (existingPost) {
      // Update headline/sourceUrl if changed (but don't recreate)
      if (existingPost.headline !== headline || existingPost.sourceUrl !== itemLink) {
        await Post.findByIdAndUpdate(existingPost._id, {
          headline,
          sourceUrl: itemLink,
          newsPublishedAt,
        });
        console.log(`🔄 Updated existing breaking news: ${headline.substring(0, 50)}...`);
      }
      return existingPost;
    }

    // Create new breaking news post
    const breakingExpiresAt = new Date();
    breakingExpiresAt.setMinutes(breakingExpiresAt.getMinutes() + 60); // 60 minutes from now

    const newPost = new Post({
      postedBy: systemUserId,
      text: summary || headline, // Use summary if available, otherwise headline
      headline,
      sourceName: source.sourceName,
      sourceUrl: itemLink,
      isBreaking: true,
      breakingExpiresAt,
      newsExternalId,
      newsPublishedAt,
      createdBySystem: true,
      img: null,
      video: null,
      likes: [],
      replies: [],
    });

    await newPost.save();
    console.log(`✨ Created breaking news: ${headline.substring(0, 50)}...`);
    return newPost;
  } catch (error) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      console.log(`⚠️ Duplicate news item (race condition): ${item.title?.substring(0, 50)}`);
      return null;
    }
    console.error(`❌ Error processing news item:`, error.message);
    return null;
  }
};

/**
 * Main ingestion function - fetches all active feeds and processes items
 */
export const ingestNews = async () => {
  try {
    console.log("🚀 Starting news ingestion...");

    // Get system user
    const systemUser = await getSystemUser();

    // Get all active news sources
    const sources = await NewsSource.find({ isActive: true });

    if (sources.length === 0) {
      console.log("ℹ️ No active news sources configured");
      return { processed: 0, errors: 0 };
    }

    console.log(`📰 Found ${sources.length} active news source(s)`);

    // Fetch all feeds with concurrency limit
    const feedResults = await Promise.all(
      sources.map((source) => limit(() => fetchFeed(source)))
    );

    let totalProcessed = 0;
    let totalErrors = 0;

    // Process items from each feed
    for (const { source, items, error } of feedResults) {
      if (error) {
        totalErrors++;
        continue;
      }

      if (items.length === 0) {
        continue;
      }

      // Process items with concurrency limit
      const processResults = await Promise.all(
        items.map((item) => limit(() => processNewsItem(item, source, systemUser._id)))
      );

      const successful = processResults.filter((r) => r !== null).length;
      totalProcessed += successful;
    }

    console.log(`✅ News ingestion complete: ${totalProcessed} items processed, ${totalErrors} errors`);
    return { processed: totalProcessed, errors: totalErrors };
  } catch (error) {
    console.error("❌ Fatal error in news ingestion:", error);
    return { processed: 0, errors: 1 };
  }
};

