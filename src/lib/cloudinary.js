import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

// Placeholder values shipped in .env. Used to fail loudly with a helpful message
// instead of letting Cloudinary reject the request with a cryptic error.
const PLACEHOLDER_VALUES = [
  'your_cloud_name_here',
  'your_cloudinary_api_secret_here',
  '123456789012345',
];

/**
 * True only when all three Cloudinary credentials are present and none of them
 * are still the dummy placeholders from .env.
 */
export function isCloudinaryConfigured() {
  const values = [CLOUD_NAME, API_KEY, API_SECRET];
  if (values.some((value) => !value)) return false;
  return !values.some((value) => PLACEHOLDER_VALUES.includes(value));
}

// Where uploads land inside the Cloudinary media library.
export const UPLOAD_FOLDERS = {
  trainerDocuments: 'fitlab/trainer-documents',
  avatars: 'fitlab/avatars',
  courseThumbnails: 'fitlab/course-thumbnails',
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_DOCUMENTS = 5; // per trainer application

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const ALLOWED_FILE_EXTENSIONS = Object.values(EXTENSION_BY_MIME);

/**
 * Validates a File from request.formData() before it is streamed to Cloudinary.
 * Returns { error } on failure, or { valid: true } on success.
 */
export function validateUploadFile(file) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return { error: 'No file was provided' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error: `Unsupported file type. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size === 0) {
    return { error: 'The file is empty' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      error: `"${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  return { valid: true };
}

/**
 * Streams a Buffer to Cloudinary.
 *
 * PDFs are stored as resource_type 'image' by Cloudinary, so 'auto' lets it
 * decide rather than us guessing wrong and breaking the delivery URL.
 *
 * @param {Buffer} buffer   file contents
 * @param {object} options
 * @param {string} options.folder      Cloudinary folder, use UPLOAD_FOLDERS
 * @param {string} [options.filename]  original filename, used for the public_id prefix
 * @returns {Promise<object>} the raw Cloudinary upload result
 */
export function uploadToCloudinary(buffer, { folder, filename } = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'auto',
      // Let Cloudinary generate the unique suffix so two files with the same
      // name never overwrite each other.
      use_filename: Boolean(filename),
      unique_filename: true,
      overwrite: false,
    };

    if (filename) {
      // Strip the extension; Cloudinary appends the correct one itself.
      uploadOptions.public_id = filename.replace(/\.[^./\\]+$/, '').slice(0, 80);
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned an empty result'));
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Removes an asset from Cloudinary. Safe to call for cleanup: it resolves to
 * null instead of throwing so a failed delete never breaks the caller.
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return null;
  }
}

/**
 * Verifies that a document reference sent by a client really points at an asset
 * in one of our Cloudinary folders. Without this a caller could POST arbitrary
 * URLs and have them stored as "verified" certificates.
 *
 * @param {object} doc      candidate { url, publicId }
 * @param {string} folder   expected folder prefix, use UPLOAD_FOLDERS
 * @returns {{ error: string } | { valid: true }}
 */
export function validateDocumentReference(doc, folder) {
  if (!doc || typeof doc !== 'object') {
    return { error: 'Invalid document reference' };
  }

  const { url, publicId } = doc;

  if (typeof url !== 'string' || typeof publicId !== 'string' || !url || !publicId) {
    return { error: 'Each document needs a url and a publicId' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return { error: 'Document url is not a valid URL' };
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
    return { error: 'Documents must be hosted on Cloudinary' };
  }

  if (CLOUD_NAME && !parsed.pathname.startsWith(`/${CLOUD_NAME}/`)) {
    return { error: 'Document does not belong to this Cloudinary account' };
  }

  if (!publicId.startsWith(`${folder}/`)) {
    return { error: 'Document was not uploaded to the expected folder' };
  }

  return { valid: true };
}

/**
 * Builds a short-lived, API-signed download URL for a stored asset.
 *
 * Why this exists: Cloudinary's free tier ships with "Allow delivery of PDF and
 * ZIP files" disabled, so the normal CDN URL for a PDF
 * (res.cloudinary.com/<cloud>/image/upload/....pdf) answers 401 with
 * "deny or ACL failure". Signing the delivery URL does not lift that block
 * either. The Admin API download endpoint is not subject to it, so it is the
 * only way to read an already-uploaded PDF without changing account settings.
 *
 * The returned URL embeds our api_key and a signature, so it must never be
 * handed to the browser. Fetch it server-side and stream the bytes instead.
 *
 * @param {string} publicId
 * @param {object} [options]
 * @param {string} [options.format]        asset format, e.g. 'pdf'
 * @param {string} [options.resourceType]  'image' | 'raw' | 'video'
 * @param {number} [options.expiresIn]     lifetime in seconds
 * @returns {string} signed URL
 */
export function buildSignedDownloadUrl(
  publicId,
  { format = 'pdf', resourceType = 'image', expiresIn = 300 } = {}
) {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    // Our assets are uploaded with the default delivery type.
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  });
}

/**
 * Builds a delivery URL that rasterises one page of a PDF to a JPEG.
 *
 * Rendering to an image sidesteps the PDF delivery restriction entirely, which
 * makes it usable as a preview thumbnail even when the PDF itself is blocked.
 *
 * @param {string} publicId
 * @param {object} [options]
 * @param {number} [options.page]   1-based page number
 * @param {number} [options.width]  resize width in pixels
 */
export function buildPdfPageImageUrl(publicId, { page = 1, width = 400 } = {}) {
  return cloudinary.url(publicId, {
    resource_type: 'image',
    type: 'upload',
    format: 'jpg',
    secure: true,
    transformation: [{ page, width, crop: 'limit', quality: 'auto' }],
  });
}

/**
 * Narrows a Cloudinary upload result down to the fields we persist.
 */
export function toStoredFile(result, originalName) {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    name: originalName || result.original_filename || '',
    format: result.format || '',
    bytes: result.bytes || 0,
    resourceType: result.resource_type || 'image',
  };
}

export default cloudinary;
