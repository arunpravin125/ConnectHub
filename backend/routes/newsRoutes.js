import express from "express";
import {
  getNewsSources,
  addNewsSource,
  deleteNewsSource,
  toggleNewsSource,
  runIngestion,
} from "../controllers/newsController.js";
import { adminAuth } from "../middleware/adminAuth.js";

export const newsRoutes = express.Router();

// All routes require admin authentication
newsRoutes.get("/sources", adminAuth, getNewsSources);
newsRoutes.post("/sources", adminAuth, addNewsSource);
newsRoutes.delete("/sources/:id", adminAuth, deleteNewsSource);
newsRoutes.put("/sources/:id/toggle", adminAuth, toggleNewsSource);
newsRoutes.post("/run", adminAuth, runIngestion);

