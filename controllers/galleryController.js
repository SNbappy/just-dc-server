const Gallery = require('../models/Gallery');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// @desc    Get all gallery albums
// @route   GET /api/gallery
// @access  Public
exports.getAllGallery = async (req, res) => {
    try {
        const { category, isPublished } = req.query;

        const query = {};
        if (category) query.category = category;
        if (isPublished !== undefined) query.isPublished = isPublished === 'true';

        const galleries = await Gallery.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: galleries.length,
            data: galleries,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Get single gallery album
// @route   GET /api/gallery/:id
// @access  Public
exports.getGallery = async (req, res) => {
    try {
        const gallery = await Gallery.findById(req.params.id).populate('createdBy', 'name email');

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found',
            });
        }

        res.status(200).json({
            success: true,
            data: gallery,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

// @desc    Create new gallery album
// @route   POST /api/gallery
// @access  Private/Admin
exports.createGallery = async (req, res) => {
    try {
        const images = [];

        // Upload all images to Cloudinary
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageUrl = await uploadToCloudinary(file.buffer, 'gallery');
                images.push({
                    url: imageUrl,
                    caption: '',
                });
            }
        }

        const galleryData = {
            ...req.body,
            images,
            createdBy: req.user.id,
        };

        const gallery = await Gallery.create(galleryData);

        res.status(201).json({
            success: true,
            message: 'Gallery created successfully',
            data: gallery,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create gallery',
            error: error.message,
        });
    }
};

// @desc    Update gallery album
// @route   PUT /api/gallery/:id
// @access  Private/Admin
exports.updateGallery = async (req, res) => {
    try {
        let gallery = await Gallery.findById(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found',
            });
        }

        // Upload new images if provided
        if (req.files && req.files.length > 0) {
            const newImages = [];
            for (const file of req.files) {
                const imageUrl = await uploadToCloudinary(file.buffer, 'gallery');
                newImages.push({
                    url: imageUrl,
                    caption: '',
                });
            }
            // Add new images to existing ones
            gallery.images.push(...newImages);
        }

        // Update other fields
        Object.keys(req.body).forEach((key) => {
            if (key !== 'images') {
                gallery[key] = req.body[key];
            }
        });

        await gallery.save();

        res.status(200).json({
            success: true,
            message: 'Gallery updated successfully',
            data: gallery,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update gallery',
            error: error.message,
        });
    }
};

// @desc    Delete image from gallery
// @route   DELETE /api/gallery/:id/image/:imageId
// @access  Private/Admin
exports.deleteImage = async (req, res) => {
    try {
        const gallery = await Gallery.findById(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found',
            });
        }

        const image = gallery.images.id(req.params.imageId);

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found',
            });
        }

        // Delete from Cloudinary
        await deleteFromCloudinary(image.url);

        // Remove from array
        gallery.images.pull(req.params.imageId);
        await gallery.save();

        res.status(200).json({
            success: true,
            message: 'Image deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: error.message,
        });
    }
};

// @desc    Delete gallery album
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGallery = async (req, res) => {
    try {
        const gallery = await Gallery.findById(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found',
            });
        }

        // Delete all images from Cloudinary
        for (const image of gallery.images) {
            await deleteFromCloudinary(image.url);
        }

        await Gallery.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Gallery deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete gallery',
            error: error.message,
        });
    }
};
