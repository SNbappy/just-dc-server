const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {String} folder - Folder name in Cloudinary
 * @returns {String} - Cloudinary URL
 */
const uploadToCloudinary = (fileBuffer, folder = 'just-debate-club') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                transformation: [
                    { width: 1000, height: 1000, crop: 'limit' },
                    { quality: 'auto' },
                ],
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

/**
 * Delete image from Cloudinary
 * @param {String} imageUrl - Cloudinary image URL
 */
const deleteFromCloudinary = async (imageUrl) => {
    try {
        // Extract public_id from URL
        const parts = imageUrl.split('/');
        const filename = parts[parts.length - 1];
        const publicId = parts.slice(-2).join('/').replace(/\.[^/.]+$/, '');

        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
    }
};

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary,
    cloudinary,
};
