// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();

const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../controllers/uploadController');

// ✅ Upload image (logged in users only)
router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;
