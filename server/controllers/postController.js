const Post = require('../models/Post');
const Vote = require('../models/Vote');

// Whitelists for query values
const VALID_SORTS = ['top', 'newest'];
const VALID_CATEGORIES = ['feature', 'bug', 'improvement'];
const VALID_STATUSES = ['open', 'planned', 'in-progress', 'shipped'];

// Escape regex special characters so user input is treated as plain text
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/posts - filtering, sorting, pagination, and hasVoted
exports.getPosts = async (req, res, next) => {
  try {
    const { sort = 'newest', category, status, search } = req.query;

    // Safe pagination: fall back to defaults for bad values, cap the limit at 50
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const skip = (pageNum - 1) * limitNum;

    if (!VALID_SORTS.includes(sort)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort value. Must be "top" or "newest".',
      });
    }

    const filter = {};

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Must be feature, bug, or improvement.',
        });
      }
      filter.category = category;
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be open, planned, in-progress, or shipped.',
        });
      }
      filter.status = status;
    }

    // Only accept a single text value for search
    if (search && typeof search === 'string') {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // "top" = most votes first; ties broken by newest so pagination stays stable
    const sortObj = sort === 'top' ? { voteCount: -1, createdAt: -1 } : { createdAt: -1 };

    const posts = await Post.find(filter)
      .populate('author', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Post.countDocuments(filter);

    // hasVoted: ONE query for all posts on this page, then a Set lookup
    let votedPostIds = new Set();
    if (req.user) {
      const votes = await Vote.find({
        user: req.user._id,
        post: { $in: posts.map((p) => p._id) },
      }).lean();
      votedPostIds = new Set(votes.map((v) => v.post.toString()));
    }

    posts.forEach((post) => {
      post.hasVoted = votedPostIds.has(post._id.toString());
    });

    res.json({
      success: true,
      posts,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/posts/:id - single post with hasVoted
exports.getPost = async (req, res, next) => {
  try {
    // .lean() returns a plain object, so the extra hasVoted field is kept in the JSON
    const post = await Post.findById(req.params.id).populate('author', 'name').lean();

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    let hasVoted = false;
    if (req.user) {
      const vote = await Vote.findOne({ user: req.user._id, post: post._id }).lean();
      hasVoted = !!vote;
    }
    post.hasVoted = hasVoted;

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts - create a post
exports.createPost = async (req, res, next) => {
  try {
    // Pick only the allowed fields so users can't set status, voteCount, adminReply, etc.
    const { title, description, category } = req.body;

    const post = new Post({
      title,
      description,
      category,
      author: req.user._id,
      status: 'open',
      voteCount: 0,
    });

    await post.save();
    await post.populate('author', 'name');

    res.status(201).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// PUT /api/posts/:id - update a post (author only)
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post',
      });
    }

    // Only these three fields can be edited
    const { title, description, category } = req.body;
    post.title = title;
    post.description = description;
    post.category = category;

    await post.save();
    await post.populate('author', 'name');

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/posts/:id - delete a post (author or admin)
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post',
      });
    }

    // Remove this post's votes first so no orphaned Vote documents are left behind
    await Vote.deleteMany({ post: post._id });
    await post.deleteOne();

    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/posts/:id/status - change status and optional admin reply (admin only)
exports.updateStatus = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { status, adminReply } = req.body;

    if (status) {
      post.status = status;
    }
    if (adminReply !== undefined) {
      post.adminReply = adminReply;
    }

    await post.save();
    await post.populate('author', 'name');

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// GET /api/roadmap - posts grouped by status; "open" posts are not included
exports.getRoadmap = async (req, res, next) => {
  try {
    const posts = await Post.find({
      status: { $in: ['planned', 'in-progress', 'shipped'] },
    })
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const roadmap = {
      planned: posts.filter((p) => p.status === 'planned'),
      inProgress: posts.filter((p) => p.status === 'in-progress'),
      shipped: posts.filter((p) => p.status === 'shipped'),
    };

    res.json({ success: true, roadmap });
  } catch (error) {
    next(error);
  }
};