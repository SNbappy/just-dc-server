const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

// @route   POST /api/upload
// @desc    Upload image to Cloudinary
// @access  Private/Admin
router.post('/', protect, admin, upload.single('image'), uploadImage);

module.exports = router;
