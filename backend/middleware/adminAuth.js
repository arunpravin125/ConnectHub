/**
 * Simple admin authentication middleware
 * Requires X-Admin-Token header matching ADMIN_TOKEN env variable
 */
export const adminAuth = (req, res, next) => {
  const adminToken = req.headers["x-admin-token"];
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      error:
        "Admin token not configured. Set ADMIN_TOKEN in environment variables.",
    });
  }

  if (!adminToken || adminToken !== expectedToken) {
    return res
      .status(403)
      .json({ error: "Unauthorized: Admin access required" });
  }

  next();
};
