const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const User = require('../models/User');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { Op } = require('sequelize');

// helper: attach createdBy + images[] like Mongo populate + embedded array
const formatGallery = async (gallery) => {
    if (!gallery) return null;

    const g = gallery.toJSON ? gallery.toJSON() : gallery;

    const [creator, images] = await Promise.all([
        User.findByPk(g.createdBy, { attributes: ['id', 'name', 'email'] }),
        GalleryImage.findAll({
            where: { galleryId: g.id },
            order: [['uploadedAt', 'ASC']]
        })
    ]);

    return {
        ...g,
        _id: g.id, // optional compatibility
        createdBy: creator ? { _id: creator.id, name: creator.name, email: creator.email } : null,
        images: images.map((img) => ({
            _id: img.id, // match old subdoc id style
            url: img.url,
            caption: img.caption || '',
            uploadedAt: img.uploadedAt
        }))
    };
};

const formatGalleries = async (galleries) => {
    if (!galleries || galleries.length === 0) return [];

    const plain = galleries.map((x) => (x.toJSON ? x.toJSON() : x));

    const creatorIds = [...new Set(plain.map((g) => g.createdBy).filter(Boolean))];
    const galleryIds = plain.map((g) => g.id);

    const [creators, images] = await Promise.all([
        User.findAll({
            where: { id: { [Op.in]: creatorIds } },
            attributes: ['id', 'name', 'email']
        }),
        GalleryImage.findAll({
            where: { galleryId: { [Op.in]: galleryIds } },
            order: [['uploadedAt', 'ASC']]
        })
    ]);

    const creatorMap = new Map(creators.map((u) => [u.id, u]));
    const imagesMap = new Map(); // galleryId -> images[]
    for (const img of images) {
        const arr = imagesMap.get(img.galleryId) || [];
        arr.push(img);
        imagesMap.set(img.galleryId, arr);
    }

    return plain.map((g) => {
        const c = creatorMap.get(g.createdBy);
        const imgs = imagesMap.get(g.id) || [];
        return {
            ...g,
            _id: g.id,
            createdBy: c ? { _id: c.id, name: c.name, email: c.email } : null,
            images: imgs.map((img) => ({
                _id: img.id,
                url: img.url,
                caption: img.caption || '',
                uploadedAt: img.uploadedAt
            }))
        };
    });
};

// @desc    Get all gallery albums
// @route   GET /api/gallery
// @access  Public
exports.getAllGallery = async (req, res) => {
    try {
        const { category, isPublished } = req.query;

        const where = {};
        if (category) where.category = category;
        if (isPublished !== undefined) where.isPublished = isPublished === 'true';

        const galleries = await Gallery.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        const data = await formatGalleries(galleries);

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get single gallery album
// @route   GET /api/gallery/:id
// @access  Public
exports.getGallery = async (req, res) => {
    try {
        const gallery = await Gallery.findByPk(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found'
            });
        }

        const data = await formatGallery(gallery);

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Create new gallery album
// @route   POST /api/gallery
// @access  Private/Admin
exports.createGallery = async (req, res) => {
    try {
        // create gallery first (without images)
        const gallery = await Gallery.create({
            title: req.body.title,
            description: req.body.description || '',
            category: req.body.category || 'Other',
            eventDate: req.body.eventDate || null,
            isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
            createdBy: req.user.id
        });

        // Upload all images to Cloudinary and insert into gallery_images
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageUrl = await uploadToCloudinary(file.buffer, 'gallery');
                await GalleryImage.create({
                    galleryId: gallery.id,
                    url: imageUrl,
                    caption: '',
                    uploadedAt: new Date()
                });
            }
        }

        const data = await formatGallery(gallery);

        res.status(201).json({
            success: true,
            message: 'Gallery created successfully',
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create gallery',
            error: error.message
        });
    }
};

// @desc    Update gallery album
// @route   PUT /api/gallery/:id
// @access  Private/Admin
exports.updateGallery = async (req, res) => {
    try {
        const gallery = await Gallery.findByPk(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found'
            });
        }

        // Upload new images if provided
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageUrl = await uploadToCloudinary(file.buffer, 'gallery');
                await GalleryImage.create({
                    galleryId: gallery.id,
                    url: imageUrl,
                    caption: '',
                    uploadedAt: new Date()
                });
            }
        }

        // Update other fields (ignore images key)
        const updates = { ...req.body };
        delete updates.images;

        // convert isPublished if it comes as string
        if (updates.isPublished !== undefined) {
            if (typeof updates.isPublished === 'string') {
                updates.isPublished = updates.isPublished === 'true';
            }
        }

        await gallery.update(updates);

        const data = await formatGallery(gallery);

        res.status(200).json({
            success: true,
            message: 'Gallery updated successfully',
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update gallery',
            error: error.message
        });
    }
};

// @desc    Delete image from gallery
// @route   DELETE /api/gallery/:id/image/:imageId
// @access  Private/Admin
exports.deleteImage = async (req, res) => {
    try {
        const gallery = await Gallery.findByPk(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found'
            });
        }

        const image = await GalleryImage.findOne({
            where: { id: req.params.imageId, galleryId: gallery.id }
        });

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Delete from Cloudinary
        await deleteFromCloudinary(image.url);

        // Delete from DB
        await image.destroy();

        res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: error.message
        });
    }
};

// @desc    Delete gallery album
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGallery = async (req, res) => {
    try {
        const gallery = await Gallery.findByPk(req.params.id);

        if (!gallery) {
            return res.status(404).json({
                success: false,
                message: 'Gallery not found'
            });
        }

        // Get all images
        const images = await GalleryImage.findAll({ where: { galleryId: gallery.id } });

        // Delete all images from Cloudinary
        for (const img of images) {
            await deleteFromCloudinary(img.url);
        }

        // Delete images from DB
        await GalleryImage.destroy({ where: { galleryId: gallery.id } });

        // Delete gallery from DB
        await gallery.destroy();

        res.status(200).json({
            success: true,
            message: 'Gallery deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete gallery',
            error: error.message
        });
    }
};
