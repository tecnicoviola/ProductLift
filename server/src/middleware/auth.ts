import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { env } from "../config/env";
import type { AuthTokenPayload } from "../utils/jwt";

function getBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function isTokenError(
  error: unknown,
  name: "TokenExpiredError" | "JsonWebTokenError"
): boolean {
  return error instanceof Error && error.name === name;
}

export const auth: RequestHandler = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      message: "No token provided",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    if (isTokenError(error, "TokenExpiredError")) {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return;
    }

    if (isTokenError(error, "JsonWebTokenError")) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const authOptional: RequestHandler = async (req, _res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }
  } catch {
    // Public routes remain accessible with an invalid or expired token.
  }

  next();
};

export default auth;