/**
 * Compresses an image File or Blob using HTML5 Canvas to reduce payload size.
 * Keeps resolution sharp while shrinking file size by 80-95%.
 * @param {File|Blob} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<Blob|File>}
 */
export const compressImage = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.82) => {
    return new Promise((resolve) => {
        if (!file || typeof file === 'string' || !(file instanceof Blob)) {
            return resolve(file);
        }
        // If file is already small (< 300KB), no need to compress
        if (file.size && file.size < 300 * 1024) {
            return resolve(file);
        }

        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
                if (blob && blob.size < file.size) {
                    resolve(blob);
                } else {
                    resolve(file);
                }
            }, mimeType, quality);
        };

        img.onerror = () => resolve(file);
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
};

/**
 * Converts a File or Blob to a Base64 Data URI string with automatic image compression.
 * If the input is already a string (URL or base64), it returns it as-is.
 * @param {File|Blob|string} file
 * @returns {Promise<string|null>}
 */
export const fileToBase64 = async (file) => {
    if (!file) return null;
    if (typeof file === 'string') return file;

    const compressed = await compressImage(file);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressed);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
