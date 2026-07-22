import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/uploads' : 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'stories'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, 'groups'), { recursive: true });

/** Raster images only — SVG is rejected (scriptable when opened as a document). */
export const SAFE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SAFE_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function isSafeImageMime(mime) {
  return SAFE_IMAGE_MIMES.has(String(mime || '').toLowerCase());
}

export function safeImageContentType(mime, fallback = 'image/jpeg') {
  const normalized = String(mime || '').toLowerCase();
  return SAFE_IMAGE_MIMES.has(normalized) ? normalized : fallback;
}

function rasterImageFilter(label) {
  return (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.svg' || mime === 'image/svg+xml' || !SAFE_IMAGE_MIMES.has(mime)) {
      return cb(new Error(`${label} must be JPEG, PNG, WebP, or GIF`));
    }
    if (ext && !SAFE_IMAGE_EXTS.has(ext)) {
      return cb(new Error(`${label} must be JPEG, PNG, WebP, or GIF`));
    }
    cb(null, true);
  };
}

const encStorage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.enc`),
});

export const upload = multer({
  storage: encStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const avatarStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, 'avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = SAFE_IMAGE_EXTS.has(ext) ? ext : '.jpg';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: rasterImageFilter('Avatar'),
});

const groupPhotoStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, 'groups'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = SAFE_IMAGE_EXTS.has(ext) ? ext : '.jpg';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

export const groupPhotoUpload = multer({
  storage: groupPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: rasterImageFilter('Group photo'),
});

const storyStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, 'stories'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    cb(null, `${crypto.randomUUID()}${ext === '.svg' ? '' : ext}`);
  },
});

export const storyUpload = multer({
  storage: storyStorage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const type = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (type === 'image/svg+xml' || ext === '.svg') {
      return cb(new Error('SVG stories are not allowed'));
    }
    if (
      SAFE_IMAGE_MIMES.has(type) ||
      type.startsWith('video/') ||
      type.startsWith('audio/') ||
      type === 'application/octet-stream'
    ) {
      return cb(null, true);
    }
    cb(new Error('Story must be an image, video, or audio file'));
  },
});

export function resolveUploadPath(storagePath) {
  const root = path.resolve(UPLOAD_DIR);
  const resolved = path.resolve(UPLOAD_DIR, storagePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid upload path');
  }
  return resolved;
}

export { UPLOAD_DIR };
