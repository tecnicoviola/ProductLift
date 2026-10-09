import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import authRoutes from "./routes/authRoutes";
import postRoutes from "./routes/postRoutes";
import roadmapRoutes from "./routes/roadmapRoutes";
import errorHandler from "./middleware/errorHandler";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_URL,
  })
);

app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests. Please try again later.",
  },
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "FeedbackBoard TypeScript API is running",
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/roadmap", roadmapRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use(errorHandler);

export default app;