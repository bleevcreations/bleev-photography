import { db, FieldValue, Timestamp, requireAdmin } from './_lib/firebase.js';
import { deleteImages } from './_lib/cloudinary.js';
import { route, readJson, httpError, methodNotAllowed } from './_lib/http.js';

const col = () => db().collection('categories');

// Shape the frontend already expects: images is a plain array (here: Cloudinary public IDs).
function toPublic(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    name: d.name,
    price: d.price || '',
    description: d.description || '',
    images: (d.images || []).map((i) => i.publicId).filter(Boolean),
    created_at: d.createdAt?.toDate?.().toISOString() ?? null,
  };
}

function cleanName(value) {
  const name = String(value || '').trim();
  if (!name) throw httpError(400, 'Category name is required.');
  if (name.length > 100) throw httpError(400, 'Category name is too long.');
  return name;
}

async function assertUniqueName(name, exceptId) {
  const snap = await col().get();
  const clash = snap.docs.find(
    (d) => d.id !== exceptId && String(d.data().name).toLowerCase() === name.toLowerCase()
  );
  if (clash) throw httpError(409, 'A category with that name already exists.');
}

export default route(async (req, res) => {
  const id = req.query.id ? String(req.query.id) : null;

  // ---------- public reads ----------
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    if (id) {
      const doc = await col().doc(id).get();
      if (!doc.exists) {
        return res.status(200).json({ success: false, message: 'Category not found' });
      }
      return res.status(200).json({ success: true, category: toPublic(doc) });
    }

    const snap = await col().orderBy('createdAt', 'desc').get();
    return res.status(200).json(snap.docs.map(toPublic));
  }

  // ---------- admin writes ----------
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) throw methodNotAllowed();
  await requireAdmin(req);

  if (req.method === 'POST') {
    const { name: rawName } = await readJson(req);
    const name = cleanName(rawName);
    await assertUniqueName(name);

    const ref = await col().add({
      name,
      price: '',
      description: '',
      images: [],
      createdAt: Timestamp.now(),
    });
    return res.status(200).json({ success: true, id: ref.id });
  }

  if (!id) throw httpError(400, 'Missing category ID');
  const ref = col().doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, 'Category not found');

  if (req.method === 'PUT') {
    const { name: rawName } = await readJson(req);
    const name = cleanName(rawName);
    await assertUniqueName(name, id);

    await ref.update({ name, updatedAt: FieldValue.serverTimestamp() });
    return res.status(200).json({ success: true });
  }

  // DELETE: remove every photo in the category from Cloudinary first.
  const { images = [] } = doc.data();
  await deleteImages(images.map((i) => i.publicId));
  await ref.delete();
  return res.status(200).json({ success: true });
});