const cloudinary = require('cloudinary').v2;

const configureCloudinary = () => {
    if (process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim()) {
        cloudinary.config();
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? process.env.CLOUDINARY_CLOUD_NAME.trim() : '',
            api_key: process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.trim() : '',
            api_secret: process.env.CLOUDINARY_API_SECRET ? process.env.CLOUDINARY_API_SECRET.trim() : '',
            secure: true,
        });
    }
};

// Initial config attempt
configureCloudinary();

/**
 * Checks if Cloudinary is configured
 */
const isCloudinaryConfigured = () => {
    if (process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim()) return true;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ? process.env.CLOUDINARY_CLOUD_NAME.trim() : '';
    const apiKey = process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.trim() : '';
    const apiSecret = process.env.CLOUDINARY_API_SECRET ? process.env.CLOUDINARY_API_SECRET.trim() : '';
    return Boolean(cloudName && apiKey && apiSecret);
};

/**
 * Uploads a single file (base64 string, data URI, or URL) to Cloudinary
 * @param {string} fileStr - Data URI or URL to upload
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
const uploadToCloudinary = async (fileStr, folder = 'dream_home') => {
    if (!fileStr || typeof fileStr !== 'string') return '';
    const trimmed = fileStr.trim();
    if (!trimmed) return '';

    // If it's already an uploaded Cloudinary / HTTP(S) URL, keep it
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary credentials not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in backend/.env');
    }

    configureCloudinary();

    const uploadResponse = await cloudinary.uploader.upload(trimmed, {
        folder,
        resource_type: 'auto',
    });

    return uploadResponse.secure_url;
};

/**
 * Uploads multiple files to Cloudinary in parallel
 * @param {Array<string>} files - Array of data URIs or URLs
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<Array<string>>} Array of secure URLs
 */
const uploadMultipleToCloudinary = async (files, folder = 'dream_home/listings') => {
    if (!files) return [];
    const fileList = Array.isArray(files) ? files : [files];
    const validFiles = fileList.filter(f => f && typeof f === 'string' && f.trim().length > 0);
    if (validFiles.length === 0) return [];

    const uploadPromises = validFiles.map(file => uploadToCloudinary(file, folder));
    return Promise.all(uploadPromises);
};

/**
 * Deletes an image from Cloudinary by public ID or URL
 * @param {string} publicIdOrUrl
 */
const deleteFromCloudinary = async (publicIdOrUrl) => {
    if (!publicIdOrUrl || typeof publicIdOrUrl !== 'string') return;
    try {
        if (!isCloudinaryConfigured()) return;
        let publicId = publicIdOrUrl;
        if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
            const matches = publicIdOrUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
            if (matches && matches[1]) {
                publicId = matches[1];
            }
        }
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Failed to delete asset from Cloudinary:', err.message);
    }
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadToCloudinary,
    uploadMultipleToCloudinary,
    deleteFromCloudinary,
};
