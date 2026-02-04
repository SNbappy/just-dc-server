const express = require('express');
const router = express.Router();
const {
    getAllGallery,
    getGallery,
    createGallery,
    updateGallery,
    deleteImage,
    deleteGallery,
} = require('../controllers/galleryController');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllGallery);
router.get('/:id', getGallery);

// Admin routes
router.post('/', protect, admin, upload.array('images', 10), createGallery);
router.put('/:id', protect, admin, upload.array('images', 10), updateGallery);
router.delete('/:id/image/:imageId', protect, admin, deleteImage);
router.delete('/:id', protect, admin, deleteGallery);

module.exports = router;
