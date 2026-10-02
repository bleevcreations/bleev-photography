import { db, FieldValue, requireAdmin } from './_lib/firebase.js';
import {
  uploadImage,
  deleteImage,
  safeName,
  slug,
} from './_lib/cloudinary.js';
import { route, readBody, httpError, methodNotAllowed } from './_lib/http.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// POST   /api/images?categoryId=..&name=photo.jpg   (raw image bytes as the body)
// DELETE /api/images?categoryId=..&fileId=..   (fileId = the image's Cloudinary public ID)
export default route(async (req, res) => {
  if (!['POST', 'DELETE'].includes(req.method)) throw methodNotAllowed();
  await requireAdmin(req);

  const categoryId = String(req.query.categoryId || '');
  if (!categoryId) throw httpError(400, 'Missing categoryId');

  const ref = db().collection('categories').doc(categoryId);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, 'Category not found');
  const data = doc.data();

  if (req.method === 'POST') {
    const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!ALLOWED.includes(mimeType)) {
      throw httpError(415, 'Only JPEG, PNG or WebP images are allowed.');
    }
    const buffer = await readBody(req);
    if (!buffer.length) throw httpError(400, 'Empty file');

    const name = safeName(req.query.name || `photo-${Date.now()}.jpg`);
    const categoryFolder = slug(data.name);

const publicId = await uploadImage({
  folder: `categories/${categoryFolder}`,
  name,
  buffer
});
    return res.status(200).json({ success: true, fileId: publicId });
  }

  const fileId = String(req.query.fileId || '');
  const images = data.images || [];
  if (!images.some((i) => i.publicId === fileId)) {
    throw httpError(404, 'Image not found in this category');
  }
  await deleteImage(fileId);
  await ref.update({ images: images.filter((i) => i.publicId !== fileId) });
  return res.status(200).json({ success: true });
});