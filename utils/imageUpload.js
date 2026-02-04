const cloudinary = require('./cloudinary');
const streamifier = require('streamifier');

const uploadToCloudinary = (fileBuffer, folder = 'just-dc') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                transformation: [
                    { width: 1920, height: 1080, crop: 'limit' },
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format
                    });
                }
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        throw new Error(error.message);
    }
};

const uploadMultipleToCloudinary = async (fileBuffers, folder = 'just-dc') => {
    const uploadPromises = fileBuffers.map(buffer => uploadToCloudinary(buffer, folder));
    return await Promise.all(uploadPromises);
};

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary,
    uploadMultipleToCloudinary
};
