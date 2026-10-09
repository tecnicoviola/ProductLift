import type { RequestHandler } from "express";
import mongoose, { type FilterQuery } from "mongoose";
import Post, {
  type IPost,
  type PostCategory,
  type PostStatus,
} from "../models/Post";
import Vote from "../models/Vote";
import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  console.error(err);

  const statusCode =
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode < 600
      ? err.statusCode
      : 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message || "Request failed",
  });
};

export default errorHandler;


const categories: PostCategory[] = [
  "feature",
  "bug",
  "improvement",
];

const statuses: PostStatus[] = [
  "open",
  "planned",
  "in-progress",
  "shipped",
];

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const getPosts: RequestHandler = async (req, res, next) => {
  try {
    const sort = queryString(req.query.sort) ?? "newest";
    const category = queryString(req.query.category);
    const status = queryString(req.query.status);
    const search = queryString(req.query.search);

    const pageValue = Number.parseInt(
      queryString(req.query.page) ?? "1",
      10
    );
    const limitValue = Number.parseInt(
      queryString(req.query.limit) ?? "6",
      10
    );

    const page = Math.max(1, pageValue || 1);
    const limit = Math.min(50, Math.max(1, limitValue || 6));
    const skip = (page - 1) * limit;

    if (sort !== "top" && sort !== "newest") {
      res.status(400).json({
        success: false,
        message: "Invalid sort option",
      });
      return;
    }

    if (category && !categories.includes(category as PostCategory)) {
      res.status(400).json({
        success: false,
        message: "Invalid category",
      });
      return;
    }

    if (status && !statuses.includes(status as PostStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid status",
      });
      return;
    }

    const filter: FilterQuery<IPost> = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { title: safeSearch },
        { description: safeSearch },
      ];
    }

    
const sortOptions: { voteCount?: 1 | -1; createdAt: 1 | -1 } =
  sort === "top"
    ? { voteCount: -1, createdAt: -1 }
    : { createdAt: -1 };



    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("author", "name")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    let votedPostIds = new Set<string>();

    if (req.user && posts.length > 0) {
      const votes = await Vote.find({
        user: req.user._id,
        post: { $in: posts.map((post) => post._id) },
      })
        .select("post")
        .lean();

      votedPostIds = new Set(
        votes.map((vote) => vote.post.toString())
      );
    }

    const postsWithVoteState = posts.map((post) => ({
      ...post,
      hasVoted: votedPostIds.has(post._id.toString()),
    }));

    res.status(200).json({
      success: true,
      posts: postsWithVoteState,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
};

export const getPost: RequestHandler = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name")
      .lean();

    if (!post) {
      res.status(404).json({
        success: false,
        message: "Post not found",
      });
      return;
    }

    let hasVoted = false;

    if (req.user) {
      const vote = await Vote.findOne({
        user: req.user._id,
        post: post._id,
      }).lean();

      hasVoted = Boolean(vote);
    }

    res.status(200).json({
      success: true,
      post: {
        ...post,
        hasVoted,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createPost: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { title, description, category } = req.body;

    const post = new Post({
      title,
      description,
      category,
      author: req.user._id,
      status: "open",
      voteCount: 0,
    });

    await post.save();
    await post.populate("author", "name");

    res.status(201).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePost: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({
        success: false,
        message: "Post not found",
      });
      return;
    }

    if (post.author.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: "Not authorized to update this post",
      });
      return;
    }

    const { title, description, category } = req.body;

    post.title = title;
    post.description = description;
    post.category = category;

    await post.save();
    await post.populate("author", "name");

    res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePost: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({
        success: false,
        message: "Post not found",
      });
      return;
    }

    const isAuthor =
      post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "Not authorized to delete this post",
      });
      return;
    }

    await Vote.deleteMany({ post: post._id });
    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: "Post deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus: RequestHandler = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({
        success: false,
        message: "Post not found",
      });
      return;
    }

    const { status, adminReply } = req.body;

    if (status !== undefined) {
      post.status = status;
    }

    if (adminReply !== undefined) {
      post.adminReply = adminReply;
    }

    await post.save();
    await post.populate("author", "name");

    res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoadmap: RequestHandler = async (_req, res, next) => {
  try {
    const posts = await Post.find({
      status: { $in: ["planned", "in-progress", "shipped"] },
    })
      .populate("author", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      roadmap: {
        planned: posts.filter((post) => post.status === "planned"),
        inProgress: posts.filter(
          (post) => post.status === "in-progress"
        ),
        shipped: posts.filter((post) => post.status === "shipped"),
      },
    });
  } catch (error) {
    next(error);
  }
};