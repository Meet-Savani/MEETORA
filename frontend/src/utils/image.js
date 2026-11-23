import { BACKEND_BASE_URL } from '../config/constants';

/**
 * Resolves an image path to a fully qualified URL.
 * Handles Cloudinary URLs, data URIs, blob URLs, and relative backend uploads.
 *
 * @param {string|null|undefined} path - The image path or URL.
 * @param {string|null} fallback - Optional fallback value if path is missing or invalid.
 * @returns {string|null} Resolved image URL or fallback.
 */
export const resolveImageUrl = (path, fallback = null) => {
    if (!path || typeof path !== 'string') return fallback;
    const trimmed = path.trim();
    if (!trimmed) return fallback;

    if (
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://')
    ) {
        return trimmed;
    }

    const clean = trimmed.replaceAll('\\', '/').replace(/^.*public\//, '').replace(/^\/+/, '');
    const cleanBase = (BACKEND_BASE_URL || '').replace(/\/+$/, '');
    return cleanBase ? `${cleanBase}/${clean}` : `/${clean}`;
};
