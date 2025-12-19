import dotenv from "dotenv";
// Load environment variables first

import express from "express";
import cors from "cors";
import { connectedDB } from "./DB/database.js";
import cookieParser from "cookie-parser";
import { userRoutes } from "./routes/userRoutes.js";
import { postRoutes } from "./routes/postRoutes.js";
import bodyParser from "body-parser";
import { v2 as cloudinary } from "cloudinary";
import { messageRoutes } from "./routes/messageRoutes.js";

import { app, server } from "./socket/socket.js";
import path from "path";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { spaceRoutes } from "./routes/spaceRoutes.js";
import { newsRoutes } from "./routes/newsRoutes.js";
import { storyRoutes } from "./routes/storyRoutes.js";
import { startNewsIngestionCron } from "./services/newsIngestionCron.js";

// const app = express()

app.use(express.json({ limit: "50mb" })); // to parse JSON data in the req.body
app.use(express.urlencoded({ extended: true, limit: "50mb" })); // to parse from data in the req.body, increased limit for file uploads
dotenv.config();
// Configure CORS for Express - support both development and production
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3005",
  "http://localhost:5173", // Vite default port
  "https://connecthub-oddy.onrender.com",
  "https://connecthub-15.onrender.com",
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL, // Render provides this automatically
].filter(Boolean);

// Helper function to check if origin is a local network IP
function isLocalNetworkOrigin(origin) {
  if (!origin) return false;

  // Match common local network IP ranges:
  // 192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.x.x.x, localhost
  const localNetworkPattern =
    /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):\d+$/;
  return localNetworkPattern.test(origin);
}

// Helper function to check if origin is a Render URL
function isRenderOrigin(origin) {
  if (!origin) return false;
  // Match Render URLs: *.onrender.com (with or without trailing slash, with or without port/path)
  const normalized = origin.replace(/\/$/, "").toLowerCase();
  // Match: https://anything.onrender.com (with optional port, path, etc.)
  const renderPattern = /^https?:\/\/[\w-]+\.onrender\.com/;
  return renderPattern.test(normalized);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Log for debugging (remove in production if needed)
      console.log(
        `[CORS] Checking origin: ${origin}, NODE_ENV: ${process.env.NODE_ENV}`
      );

      // In development, allow localhost, 127.0.0.1, and local network IPs
      if (process.env.NODE_ENV !== "production") {
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          isLocalNetworkOrigin(origin)
        ) {
          console.log(`[CORS] Allowed (development): ${origin}`);
          return callback(null, true);
        }
      }

      // Always allow Render URLs (both development and production)
      if (isRenderOrigin(origin)) {
        console.log(`[CORS] Allowed (Render URL): ${origin}`);
        return callback(null, true);
      }

      // Check against allowed origins (exact match, no trailing slash)
      const normalizedOrigin = origin.replace(/\/$/, "").toLowerCase(); // Remove trailing slash and normalize
      const normalizedAllowed = allowedOrigins.map((o) =>
        o.replace(/\/$/, "").toLowerCase()
      );

      if (normalizedAllowed.indexOf(normalizedOrigin) !== -1) {
        console.log(`[CORS] Allowed (explicit): ${origin}`);
        callback(null, true);
      } else {
        // In production on Render, be more permissive - allow if it looks like a valid URL
        if (process.env.NODE_ENV === "production" && process.env.RENDER) {
          // If we're on Render and it's a valid HTTPS URL, allow it
          if (origin.startsWith("https://")) {
            console.log(
              `[CORS] Allowed (Render production fallback): ${origin}`
            );
            return callback(null, true);
          }
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        console.warn(`[CORS] NODE_ENV: ${process.env.NODE_ENV}`);
        console.warn(`[CORS] RENDER: ${process.env.RENDER}`);
        console.warn(`[CORS] Allowed origins:`, allowedOrigins);
        console.warn(`[CORS] Is Render origin:`, isRenderOrigin(origin));
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

app.use(cookieParser());
// Increase the request size limit for file uploads
app.use(bodyParser.json({ limit: "50mb" })); // for JSON data
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Force port 4901 for development (override any PORT env var)
const usePort =
  process.env.NODE_ENV === "production" ? process.env.PORT || 4900 : 4900;

const __dirname = path.resolve();

app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/stories", storyRoutes);

// http://localhost:4900 =>backend run,add frontend

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));

  // react app

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
}

// Bind to 0.0.0.0 to allow network access (use specific IP in production)
const bindAddress = process.env.BIND_ADDRESS || "0.0.0.0";

server.listen(usePort, bindAddress, async () => {
  console.log(`🚀 Server starting on port ${usePort}...`);
  await connectedDB();
  console.log(`✅ Server started successfully on port ${usePort}`);
  console.log(`🔌 Socket.IO server ready at http://${bindAddress}:${usePort}`);
  console.log(
    `📡 WebSocket endpoint: ws://${bindAddress}:${usePort}/socket.io/`
  );

  // Show network access info
  if (bindAddress === "0.0.0.0") {
    console.log(`🌐 Server accessible from network on port ${usePort}`);
    console.log(`   Access from other devices: http://YOUR_IP:${usePort}`);
  }

  // Start news ingestion cron job
  startNewsIngestionCron();
  console.log(`📰 News ingestion cron job started (every 3 minutes)`);
});
// http://localhost:4900 =>backend run
// http://localhost:3000 =>frontend run

// http://localhost:4900 =>backend run,add frontend
