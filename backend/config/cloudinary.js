import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const cleanName = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    return {
      folder: 'lms_uploads',
      resource_type: 'auto',
      public_id: `${Date.now()}-${cleanName}`,
    };
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max limit
});

// Profile picture uploads (images only, auto-cropped to a square)
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req) => ({
    folder: 'lms_avatars',
    resource_type: 'image',
    public_id: `${req.user?._id || 'user'}-${Date.now()}`,
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  }),
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures.'));
    }
  },
});

/**
 * Extract { publicId, resourceType } from a Cloudinary delivery URL.
 * e.g. https://res.cloudinary.com/<cloud>/raw/upload/v1712345/lms_uploads/123-file.pptx
 * Raw resources keep their extension in the public_id; image/video resources do not.
 */
const parseCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/(image|video|raw)\/upload\/(.+)$/);
  if (!match) return null;

  const resourceType = match[1];
  let path = match[2].split('?')[0];
  // Drop the version segment (v123456789/)
  path = path.replace(/^v\d+\//, '');
  path = decodeURIComponent(path);

  const publicId = resourceType === 'raw' ? path : path.replace(/\.[^/.]+$/, '');
  return { publicId, resourceType };
};

/**
 * Delete a stored Cloudinary asset. Never throws: storage cleanup must not
 * block the database operation that triggered it.
 * Accepts an attachment-like object ({ publicId, resourceType, fileUrl }) or a URL string.
 */
const destroyCloudinaryAsset = async (assetOrUrl) => {
  try {
    if (!assetOrUrl) return;
    let publicId;
    let resourceType;

    if (typeof assetOrUrl === 'string') {
      ({ publicId, resourceType } = parseCloudinaryUrl(assetOrUrl) || {});
    } else {
      publicId = assetOrUrl.publicId;
      resourceType = assetOrUrl.resourceType;
      if (!publicId) {
        ({ publicId, resourceType } = parseCloudinaryUrl(assetOrUrl.fileUrl) || {});
      }
    }

    if (!publicId) return;

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image',
      invalidate: true,
    });

    // If the resource type guess was wrong, try the other common types
    if (result?.result === 'not found' && !resourceType) {
      for (const type of ['raw', 'video']) {
        const retry = await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
        if (retry?.result === 'ok') break;
      }
    }
  } catch (error) {
    console.error('Cloudinary cleanup failed:', error.message);
  }
};

const destroyCloudinaryAssets = async (assets = []) => {
  await Promise.all((assets || []).map((a) => destroyCloudinaryAsset(a)));
};

export {
  cloudinary,
  upload,
  avatarUpload,
  parseCloudinaryUrl,
  destroyCloudinaryAsset,
  destroyCloudinaryAssets,
};
