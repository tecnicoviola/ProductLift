import mongoose, { type HydratedDocument, Types } from "mongoose";
import { env } from "../config/env";
import User, { type IUser, type UserRole } from "../models/User";
import Post, {
  type PostCategory,
  type PostStatus,
} from "../models/Post";
import Vote from "../models/Vote";

interface SeedPost {
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  authorIndex: number;
}

const postData: SeedPost[] = [
  {
    title: "Dark mode support",
    description: "Add a dark theme so the app is easier on the eyes at night.",
    category: "feature",
    status: "planned",
    authorIndex: 1,
  },
  {
    title: "Login page misaligned on mobile",
    description: "The login form overflows the screen on small phones.",
    category: "bug",
    status: "in-progress",
    authorIndex: 2,
  },
  {
    title: "Export feedback as CSV",
    description: "Let admins download all feedback posts as a CSV file.",
    category: "feature",
    status: "open",
    authorIndex: 1,
  },
  {
    title: "Faster page loading",
    description: "The board takes too long to load when there are many posts.",
    category: "improvement",
    status: "shipped",
    authorIndex: 2,
  },
  {
    title: "Email me when status changes",
    description: "Send an email when a post I voted on changes status.",
    category: "feature",
    status: "open",
    authorIndex: 1,
  },
  {
    title: "Vote count not updating",
    description: "Sometimes the vote count looks stale after refreshing.",
    category: "bug",
    status: "shipped",
    authorIndex: 2,
  },
  {
    title: "Better search filters",
    description: "Allow filtering posts by multiple categories at once.",
    category: "improvement",
    status: "planned",
    authorIndex: 0,
  },
  {
    title: "Two-factor authentication",
    description: "Add 2FA to make accounts more secure for everyone.",
    category: "feature",
    status: "planned",
    authorIndex: 1,
  },
  {
    title: "Keyboard shortcuts",
    description: "Add shortcuts for voting and navigating between posts.",
    category: "improvement",
    status: "open",
    authorIndex: 2,
  },
  {
    title: "Profile page for users",
    description: "Show each user their submitted posts and votes in one place.",
    category: "feature",
    status: "in-progress",
    authorIndex: 0,
  },
  {
    title: "Typo on the roadmap page",
    description: "The heading on the roadmap page has a spelling mistake.",
    category: "bug",
    status: "open",
    authorIndex: 1,
  },
  {
    title: "Mobile app version",
    description: "A native mobile app would make it easier to submit feedback.",
    category: "feature",
    status: "open",
    authorIndex: 2,
  },
];

const userData: Array<{
  name: string;
  email: string;
  password: string;
  role: UserRole;
}> = [
  {
    name: "Admin User",
    email: "admin@feedbackboard.com",
    password: "Admin123!",
    role: "admin",
  },
  {
    name: "Priya Sharma",
    email: "priya@example.com",
    password: "User123!",
    role: "user",
  },
  {
    name: "Rahul Verma",
    email: "rahul@example.com",
    password: "User123!",
    role: "user",
  },
];

async function seed(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("MongoDB connected");

    // WARNING: This clears all existing users, posts, and votes.
    await Vote.deleteMany({});
    await Post.deleteMany({});
    await User.deleteMany({});
    console.log("Collections cleared");

    // Create users individually so save middleware hashes passwords.
    const users: HydratedDocument<IUser>[] = [];

    for (const data of userData) {
      users.push(await User.create(data));
    }

    console.log(`Created ${users.length} users`);

    const votes: Array<{
      user: Types.ObjectId;
      post: Types.ObjectId;
    }> = [];

    for (const data of postData) {
      const author = users[data.authorIndex];

      if (!author) {
        throw new Error(
          `No user found at author index ${data.authorIndex}`
        );
      }

      const voters = users.filter(() => Math.random() < 0.6);

      const post = await Post.create({
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        author: author._id,
        voteCount: voters.length,
      });

      for (const voter of voters) {
        votes.push({
          user: voter._id,
          post: post._id,
        });
      }
    }

    if (votes.length > 0) {
      await Vote.insertMany(votes);
    }

    console.log(
      `Created ${postData.length} posts and ${votes.length} votes`
    );
    console.log("Seed completed successfully");
  } catch (error: unknown) {
    console.error(
      "Seed error:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seed();
