import cron from "node-cron";
import { ingestNews } from "./newsIngestionService.js";

let cronJob = null;

/**
 * Start the news ingestion cron job
 * Runs every 3 minutes
 */
export const startNewsIngestionCron = () => {
  // Stop existing job if any
  if (cronJob) {
    cronJob.stop();
  }

  // Schedule job to run every 3 minutes
  cronJob = cron.schedule("*/3 * * * *", async () => {
    console.log("⏰ Cron: Running scheduled news ingestion...");
    try {
      await ingestNews();
    } catch (error) {
      console.error("❌ Cron: Error in scheduled news ingestion:", error);
    }
  });

  console.log("✅ News ingestion cron job scheduled (every 3 minutes)");
};

/**
 * Stop the news ingestion cron job
 */
export const stopNewsIngestionCron = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("⏹️ News ingestion cron job stopped");
  }
};

