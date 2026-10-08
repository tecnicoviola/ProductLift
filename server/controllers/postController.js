const Post = require('../models/Post');
const Vote = require('../models/Vote');

// Whitelist for sort, category, and status values
const VALID_SORTS = ['top', 'newest'];
const VALID_CATEGORIES = ['feature', 'bug', 'improvement'];
const VALID_STATUSES = ['open', 'planned', 'in-progress', 'shipped'];

// Escape regex special characters for safe search
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// GET /api/posts - Get posts with filtering, sorting, pagination, and hasVoted
exports.getPosts = async (req, res, next) => {
  try {
    const {
      sort = 'newest',
      category,
      status,
      search,
      page = 1,
      limit = 6,
    } = req.query;

    // Validate and whitelist sort
    if (!VALID_SORTS.includes(sort)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort value. Must be "top" or "newest".',
      });
    }

    // Build query filter
    const filter = {};

    // Validate and add category filter
    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Must be feature, bug, or improvement.',
        });
      }
      filter.category = category;
    }

    // Validate and add status filter
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be open, planned, in-progress, or shipped.',
        });
      }
      filter.status = status;
    }

    // Add search filter with escaped regex
    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // Determine sort object
    const sortObj = sort === 'top' ? { voteCount: -1, createdAt: -1 } : { createdAt: -1 };

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination and populate author
    const posts = await Post.find(filter)
      .populate('author', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await Post.countDocuments(filter);

    // Compute hasVoted for authenticated users with a single query
    if (req.user) {
      const postIds = posts.map((p) => p._id);
      const votes = await Vote.find({
        user: req.user._id,
        post: { $in: postIds },
      }).lean();

      const votedPostIds = new Set(votes.map((v) => v.post.toString()));

      posts.forEach((post) => {
        post.hasVoted = votedPostIds.has(post._id.toString());
      });
    }

    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      posts,
      page: pageNum,
      pages,
      total,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/posts/:id - Get single post with hasVoted
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Compute hasVoted if user is authenticated
    if (req.user) {
      const vote = await Vote.findOne({
        user: req.user._id,
        post: req.params.id,
      }).lean();
      post.hasVoted = !!vote;
    }

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// POST /api/posts - Create a new post
exports.createPost = async (req, res, next) => {
  try {
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
    await post.populate('author', 'name email');

    res.status(201).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// PUT /api/posts/:id - Update a post (author only)
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post',
      });
    }

    // Update only title, description, category
    const { title, description, category } = req.body;
    post.title = title;
    post.description = description;
    post.category = category;

    await post.save();
    await post.populate('author', 'name email');

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/posts/:id - Delete a post (author or admin)
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if user is author or admin
    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post',
      });
    }

    // Delete all votes for this post
    await Vote.deleteMany({ post: req.params.id });

    // Delete post
    await Post.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/posts/:id/status - Update post status and adminReply (admin only)
exports.updateStatus = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { status, adminReply } = req.body;

    // Update status
    if (status) {
      post.status = status;
    }

    // Optionally update adminReply
    if (adminReply !== undefined) {
      post.adminReply = adminReply;
    }

    await post.save();
    await post.populate('author', 'name email');

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// GET /api/roadmap - Get roadmap grouped by status
exports.getRoadmap = async (req, res, next) => {
  try {
    const posts = await Post.find({
      status: { $in: ['planned', 'in-progress', 'shipped'] },
    })
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Group by status
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
