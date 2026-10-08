const express = require('express');
const postController = require('../controllers/postController');

const router = express.Router();

// Public route
router.get('/', postController.getRoadmap);

module.exports = router;
