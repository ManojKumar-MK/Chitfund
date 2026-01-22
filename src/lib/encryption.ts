import CryptoJS from 'crypto-js';

// Get secret from env or fallback (In prod, MUST be in env)
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-secure-key-change-this';

/**
 * Encrypts a string (e.g. Base64 image) using AES.
 */
export const encryptData = (data: string): string => {
    if (!data) return '';
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
};

/**
 * Decrypts an encrypted string back to original format.
 */
export const decryptData = (ciphertext: string): string => {
    if (!ciphertext) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error("Decryption failed:", error);
        return '';
    }
};

/**
 * Compresses an image file to a lower resolution Base64 string.
 * It strictly enforces a file size limit (default ~300KB) to ensure it fits in Firestore.
 * It will iteratively reduce quality and dimensions until the target size is met.
 */
export const compressAndConvertToBase64 = (file: File, maxWidth = 800, maxSizeBytes = 300 * 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Validation: Reject files > 5MB immediately to save processing time
        if (file.size > 5 * 1024 * 1024) {
            reject(new Error("File is too large (>5MB). Please choose a smaller image."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        // Timeout safety
        const timeout = setTimeout(() => reject(new Error("Image processing timed out")), 10000);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                clearTimeout(timeout);
                let width = img.width;
                let height = img.height;
                let quality = 0.6; // Start with lower quality for speed

                // Initial resizing logic - Aggressive downscaling
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                // Recursive function to try compressing until small enough
                const tryCompress = (currentQuality: number, currentWidth: number, currentHeight: number): string => {
                    canvas.width = currentWidth;
                    canvas.height = currentHeight;
                    ctx.clearRect(0, 0, currentWidth, currentHeight);
                    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

                    // Try to get data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', currentQuality);

                    // Check size (approximate string length to bytes: 1 char ~= 1 byte, but Base64 is 4/3 larger than binary)
                    // The Firestore limit applies to the STRING size mainly.
                    if (dataUrl.length > maxSizeBytes && currentQuality > 0.1) {
                        // Too big, reduce quality drastically to find fit
                        const newQuality = currentQuality - 0.15; // Faster degradation
                        // Reduce size if quality is already low
                        const nextWidth = currentQuality < 0.4 ? currentWidth * 0.7 : currentWidth;
                        const nextHeight = currentQuality < 0.4 ? currentHeight * 0.7 : currentHeight;

                        console.log(`Compression retry: Quality ${newQuality.toFixed(2)}, Size: ${(dataUrl.length / 1024).toFixed(0)}KB`);
                        return tryCompress(newQuality, nextWidth, nextHeight);
                    }

                    console.log(`Final compression: Quality ${currentQuality.toFixed(2)}, Size: ${(dataUrl.length / 1024).toFixed(0)}KB`);
                    return dataUrl;
                };

                try {
                    const finalDataUrl = tryCompress(quality, width, height);
                    resolve(finalDataUrl);
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = (err) => { clearTimeout(timeout); reject(err); };
        };
        reader.onerror = (err) => { clearTimeout(timeout); reject(err); };
    });
};
