const express = require('express');
const auth = require('../middleware/auth');
const { authOptional } = auth;
const adminOnly = require('../middleware/adminOnly');
const { postValidation, statusValidation } = require('../middleware/validate');
const postController = require('../controllers/postController');
const voteController = require('../controllers/voteController');

const router = express.Router();

// Public routes
router.get('/', authOptional, postController.getPosts);
router.get('/:id', authOptional, postController.getPost);

// Protected routes (authenticated user required)
router.post('/', auth, postValidation, postController.createPost);
router.put('/:id', auth, postValidation, postController.updatePost);
router.delete('/:id', auth, postController.deletePost);
router.post('/:id/vote', auth, voteController.toggleVote);

// Admin-only routes
router.patch('/:id/status', auth, adminOnly, statusValidation, postController.updateStatus);

module.exports = router;
