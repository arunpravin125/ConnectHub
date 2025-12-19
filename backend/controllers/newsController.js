import NewsSource from "../Models/newsSourceModel.js";
import { ingestNews } from "../services/newsIngestionService.js";

/**
 * Get all news sources
 */
export const getNewsSources = async (req, res) => {
  try {
    const sources = await NewsSource.find().sort({ createdAt: -1 });
    res.status(200).json({ sources });
  } catch (error) {
    console.error("Error in getNewsSources:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Add a new news source (RSS feed)
 */
export const addNewsSource = async (req, res) => {
  try {
    const { feedUrl, sourceName } = req.body;

    if (!feedUrl || !sourceName) {
      return res.status(400).json({
        error: "feedUrl and sourceName are required",
      });
    }

    // Validate URL format
    try {
      new URL(feedUrl);
    } catch (urlError) {
      return res.status(400).json({ error: "Invalid feedUrl format" });
    }

    // Check if source already exists
    const existing = await NewsSource.findOne({ feedUrl });
    if (existing) {
      return res.status(409).json({ error: "Feed URL already exists" });
    }

    const newSource = new NewsSource({
      feedUrl: feedUrl.trim(),
      sourceName: sourceName.trim(),
      isActive: true,
    });

    await newSource.save();

    res.status(201).json({
      success: true,
      source: newSource,
      message: "News source added successfully",
    });
  } catch (error) {
    console.error("Error in addNewsSource:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Feed URL already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a news source
 */
export const deleteNewsSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await NewsSource.findById(id);
    if (!source) {
      return res.status(404).json({ error: "News source not found" });
    }

    await NewsSource.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "News source deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteNewsSource:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Toggle active status of a news source
 */
export const toggleNewsSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await NewsSource.findById(id);
    if (!source) {
      return res.status(404).json({ error: "News source not found" });
    }

    source.isActive = !source.isActive;
    await source.save();

    res.status(200).json({
      success: true,
      source,
      message: `News source ${source.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    console.error("Error in toggleNewsSource:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manually trigger news ingestion (for testing)
 */
export const runIngestion = async (req, res) => {
  try {
    console.log("🔧 Manual news ingestion triggered");
    const result = await ingestNews();

    res.status(200).json({
      success: true,
      message: "News ingestion completed",
      result,
    });
  } catch (error) {
    console.error("Error in runIngestion:", error);
    res.status(500).json({ error: error.message });
  }
};

