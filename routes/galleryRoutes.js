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

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ================= PUBLIC =================
router.get('/', getAllGallery);
router.get('/:id', getGallery);

// ================= MANAGEMENT =================
// Admin / President / General Secretary only

router.post(
    '/',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    upload.array('images', 10),
    createGallery
);

router.put(
    '/:id',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    upload.array('images', 10),
    updateGallery
);

router.delete(
    '/:id/image/:imageId',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    deleteImage
);

router.delete(
    '/:id',
    protect,
    authorize('admin', 'president', 'general_secretary'),
    deleteGallery
);

module.exports = router;
