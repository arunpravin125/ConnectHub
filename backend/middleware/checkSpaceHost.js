import Space from "../Models/spaceModel.js";

/**
 * Middleware to check if the current user is the host of a space
 * Must be used after protectRoute middleware
 */
export const checkSpaceHost = async (req, res, next) => {
  try {
    const { id: spaceId } = req.params;
    const userId = req.user._id;

    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ error: "Space not found" });
    }

    // Check if user is the host
    if (space.hostId.toString() !== userId.toString()) {
      return res.status(403).json({ 
        error: "Only the space host can perform this action" 
      });
    }

    // Attach space to request for use in controllers
    req.space = space;
    next();
  } catch (error) {
    console.error("Error in checkSpaceHost:", error);
    res.status(500).json({ error: error.message });
  }
};

