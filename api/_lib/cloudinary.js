import { v2 as cloudinary } from 'cloudinary';
import { httpError } from './http.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Every asset lives under this prefix; /api/image refuses anything outside it.
export const ROOT = process.env.CLOUDINARY_ROOT_FOLDER || 'bleev';

export const safeName = (s) =>
  String(s).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 120) || 'untitled';

// "My Photo (1).JPG" -> "my-photo-1"  (public IDs should stay URL-friendly)
const slug = (s) =>
  String(s)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'photo';

const rand = () => Math.random().toString(36).slice(2, 8);

// folder e.g. `categories/<firestoreId>` or `about`. Returns the Cloudinary public_id.
export function uploadImage({ folder, name, buffer }) {
  const public_id = `${ROOT}/${folder}/${slug(name)}-${rand()}`;
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        // asset_folder puts the photo in a real folder in the Media Library (dynamic folder mode).
        { public_id, asset_folder: `${ROOT}/${folder}`, resource_type: 'image', overwrite: false },
        (err, result) => {
          if (err || !result) {
            console.error('Cloudinary upload failed:', err);
            return reject(httpError(502, 'Cloudinary error while uploading a file'));
          }
          resolve(result.public_id);
        }
      )
      .end(buffer);
  });
}

export async function deleteImages(publicIds) {
  const ids = [...new Set(publicIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    try {
      await cloudinary.api.delete_resources(ids.slice(i, i + 100), {
        resource_type: 'image',
        invalidate: true,
      });
    } catch (err) {
      console.error('Cloudinary delete failed:', err);
      throw httpError(502, 'Cloudinary error while deleting');
    }
  }
}

export const deleteImage = (publicId) => deleteImages([publicId]);

// Delivery URL. width = undefined -> the original file, untouched.
export function imageUrl(publicId, width) {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'image',
    ...(width
      ? { transformation: [{ width, crop: 'limit' }, { fetch_format: 'auto', quality: 'auto' }] }
      : {}),
  });
}