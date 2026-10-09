import type { RequestHandler } from "express";

const adminOnly: RequestHandler = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return;
  }

  next();
};

export default adminOnly;