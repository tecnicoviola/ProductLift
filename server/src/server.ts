import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";

async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`FeedbackBoard TypeScript server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the TypeScript server:", error);
    process.exit(1);
  }
}

void startServer();