const { uploadToCloudinary, uploadMultipleToCloudinary, deleteFromCloudinary } = require('../utils/imageUpload');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload an image'
            });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a valid image (JPEG, PNG, JPG, WEBP)'
            });
        }

        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'Image size should not exceed 10MB'
            });
        }

        const folder = req.body.folder || 'just-dc/events';
        const result = await uploadToCloudinary(req.file.buffer, folder);

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
                format: result.format
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.uploadMultipleImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please upload at least one image'
            });
        }

        if (req.files.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Cannot upload more than 10 images at once'
            });
        }

        for (const file of req.files) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: 'All files must be valid images (JPEG, PNG, JPG, WEBP)'
                });
            }

            if (file.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: 'Each image should not exceed 10MB'
                });
            }
        }

        const folder = req.body.folder || 'just-dc/gallery';
        const fileBuffers = req.files.map(file => file.buffer);
        const results = await uploadMultipleToCloudinary(fileBuffers, folder);

        res.json({
            success: true,
            message: 'Images uploaded successfully',
            count: results.length,
            data: results.map(result => ({
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
                format: result.format
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteImage = async (req, res) => {
    try {
        const publicId = req.params.publicId.replace(/:/g, '/');

        const result = await deleteFromCloudinary(publicId);

        if (result.result !== 'ok') {
            return res.status(404).json({
                success: false,
                message: 'Image not found or already deleted'
            });
        }

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
