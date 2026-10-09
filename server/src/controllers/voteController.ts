import type { RequestHandler } from "express";
import Post from "../models/Post";
import Vote from "../models/Vote";

export const toggleVote: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);

    if (!post) {
      res.status(404).json({
        success: false,
        message: "Post not found",
      });
      return;
    }

    const existingVote = await Vote.findOneAndDelete({
      user: userId,
      post: postId,
    });

    if (existingVote) {
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { voteCount: -1 } },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: "Vote removed",
        voted: false,
        voteCount: updatedPost?.voteCount ?? 0,
      });
      return;
    }

    await Vote.create({
      user: userId,
      post: postId,
    });

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { voteCount: 1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Vote added",
      voted: true,
      voteCount: updatedPost?.voteCount ?? 0,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      try {
        const currentPost = await Post.findById(req.params.id);

        if (!currentPost) {
          res.status(404).json({
            success: false,
            message: "Post not found",
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: "Vote already exists",
          voted: true,
          voteCount: currentPost.voteCount,
        });
      } catch (followUpError) {
        next(followUpError);
      }

      return;
    }

    next(error);
  }
};