const Post = require('../models/Post');
const Vote = require('../models/Vote');

// POST /api/posts/:id/vote - Toggle vote on a post
exports.toggleVote = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Try to find existing vote
    const existingVote = await Vote.findOneAndDelete({ user: userId, post: postId });

    if (existingVote) {
      // Vote existed, so we deleted it. Decrement voteCount.
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { voteCount: -1 } },
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Vote removed',
        voted: false,
        voteCount: updatedPost.voteCount,
      });
    }

    // Vote did not exist, so create one
    try {
      await Vote.create({ user: userId, post: postId });

      // Vote created successfully. Increment voteCount.
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { voteCount: 1 } },
        { new: true }
      );

      return res.json({
        success: true,
        message: 'Vote added',
        voted: true,
        voteCount: updatedPost.voteCount,
      });
    } catch (createError) {
      // Handle duplicate key error (11000) - concurrent vote from another request
      if (createError.code === 11000) {
        // Fetch current state of the post and return current vote status
        const currentPost = await Post.findById(postId);
        return res.json({
          success: true,
          message: 'Vote already exists',
          voted: true,
          voteCount: currentPost.voteCount,
        });
      }

      // Re-throw any other error
      throw createError;
    }
  } catch (error) {
    next(error);
  }
};
