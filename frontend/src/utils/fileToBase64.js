/**
 * Converts a File or Blob to a Base64 Data URI string.
 * If the input is already a string (URL or base64), it returns it as-is.
 * @param {File|Blob|string} file
 * @returns {Promise<string|null>}
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        if (typeof file === 'string') return resolve(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
