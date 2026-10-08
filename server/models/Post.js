const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['feature', 'bug', 'improvement'],
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'planned', 'in-progress', 'shipped'],
      default: 'open',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Changed only by the vote controller using $inc
    voteCount: {
      type: Number,
      default: 0,
    },
    adminReply: {
      type: String,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Indexes to speed up filtering and sorting
postSchema.index({ status: 1 });
postSchema.index({ category: 1 });
postSchema.index({ voteCount: -1, createdAt: -1 }); // "top" sort
postSchema.index({ createdAt: -1 }); // "newest" sort

module.exports = mongoose.model('Post', postSchema);