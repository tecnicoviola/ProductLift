require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Vote = require('../models/Vote');

// authorIndex refers to the position in the users array below (0 = admin)
const postData = [
  { title: 'Dark mode support', description: 'Add a dark theme so the app is easier on the eyes at night.', category: 'feature', status: 'planned', authorIndex: 1 },
  { title: 'Login page misaligned on mobile', description: 'The login form overflows the screen on small phones.', category: 'bug', status: 'in-progress', authorIndex: 2 },
  { title: 'Export feedback as CSV', description: 'Let admins download all feedback posts as a CSV file.', category: 'feature', status: 'open', authorIndex: 1 },
  { title: 'Faster page loading', description: 'The board takes too long to load when there are many posts.', category: 'improvement', status: 'shipped', authorIndex: 2 },
  { title: 'Email me when status changes', description: 'Send an email when a post I voted on changes status.', category: 'feature', status: 'open', authorIndex: 1 },
  { title: 'Vote count not updating', description: 'Sometimes the vote count looks stale after refreshing.', category: 'bug', status: 'shipped', authorIndex: 2 },
  { title: 'Better search filters', description: 'Allow filtering posts by multiple categories at once.', category: 'improvement', status: 'planned', authorIndex: 0 },
  { title: 'Two-factor authentication', description: 'Add 2FA to make accounts more secure for everyone.', category: 'feature', status: 'planned', authorIndex: 1 },
  { title: 'Keyboard shortcuts', description: 'Add shortcuts for voting and navigating between posts.', category: 'improvement', status: 'open', authorIndex: 2 },
  { title: 'Profile page for users', description: 'Show each user their submitted posts and votes in one place.', category: 'feature', status: 'in-progress', authorIndex: 0 },
  { title: 'Typo on the roadmap page', description: 'The heading on the roadmap page has a spelling mistake.', category: 'bug', status: 'open', authorIndex: 1 },
  { title: 'Mobile app version', description: 'A native mobile app would make it easier to submit feedback.', category: 'feature', status: 'open', authorIndex: 2 },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Start from a clean database
    await Vote.deleteMany({});
    await Post.deleteMany({});
    await User.deleteMany({});
    console.log('Collections cleared');

    // Create users one by one so the password-hashing pre-save hook runs
    const userData = [
      { name: 'Admin User', email: 'admin@feedbackboard.com', password: 'Admin123!', role: 'admin' },
      { name: 'Priya Sharma', email: 'priya@example.com', password: 'User123!', role: 'user' },
      { name: 'Rahul Verma', email: 'rahul@example.com', password: 'User123!', role: 'user' },
    ];
    const users = [];
    for (const data of userData) {
      users.push(await User.create(data));
    }
    console.log(`Created ${users.length} users`);

    // Create posts. For each post, pick which users voted on it, then set
    // voteCount from that list so the count always matches the Vote documents.
    const votes = [];
    for (const data of postData) {
      const voters = users.filter(() => Math.random() < 0.6);

      const post = await Post.create({
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        author: users[data.authorIndex]._id,
        voteCount: voters.length,
      });

      voters.forEach((voter) => votes.push({ user: voter._id, post: post._id }));
    }
    await Vote.insertMany(votes);
    console.log(`Created ${postData.length} posts and ${votes.length} votes`);

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seed();