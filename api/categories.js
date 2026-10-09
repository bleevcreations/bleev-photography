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

// Placed categories (position 0, 1, 2 ...) come last, in that order.
// Categories you haven't placed yet (e.g. a brand-new one) come first,
// newest first, which is how the list worked before.
function sortCategories(docs) {
  const placed = (doc) => typeof doc.data().position === 'number';
  const created = (doc) => doc.data().createdAt?.toMillis?.() ?? 0;

  return [...docs].sort((a, b) => {
    if (placed(a) !== placed(b)) return placed(a) ? 1 : -1;
    if (placed(a)) return a.data().position - b.data().position;
    return created(b) - created(a);
  });
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

    const snap = await col().get();
    return res.status(200).json(sortCategories(snap.docs).map(toPublic));
  }

  // ---------- admin writes ----------
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) throw methodNotAllowed();
  await requireAdmin(req);

  // PATCH /api/categories   body { "order": ["id1", "id2", ...] }
  if (req.method === 'PATCH') {
    const { order } = await readJson(req);
    if (!Array.isArray(order) || order.some((x) => typeof x !== 'string')) {
      throw httpError(400, '"order" must be a list of category ids.');
    }

    const snap = await col().get();
    const known = new Set(snap.docs.map((d) => d.id));
    const wanted = [...new Set(order)].filter((x) => known.has(x));
    // anything the list didn't mention goes after, in its current order
    const rest = sortCategories(snap.docs).map((d) => d.id).filter((x) => !wanted.includes(x));

    const batch = db().batch();
    [...wanted, ...rest].forEach((categoryId, i) => batch.update(col().doc(categoryId), { position: i }));
    await batch.commit();
    return res.status(200).json({ success: true });
  }

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