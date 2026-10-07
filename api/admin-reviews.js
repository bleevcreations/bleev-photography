import { db, FieldValue, Timestamp, requireAdmin } from './_lib/firebase.js';
import { route, readJson, httpError, methodNotAllowed } from './_lib/http.js';

const reviewsCol = () => db().collection('reviews');

// GET    /api/admin-reviews              all reviews (pinned first, then newest)
// PATCH  /api/admin-reviews?id=..        body { "pinned": true | false }
// DELETE /api/admin-reviews?id=..        delete one review
// Admin only: every request needs the Firebase login token.
export default route(async (req, res) => {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) throw methodNotAllowed();
  await requireAdmin(req);
  res.setHeader('Cache-Control', 'no-store');

  // ---------- list ----------
  if (req.method === 'GET') {
    const [revs, cats] = await Promise.all([
      reviewsCol().get(),
      db().collection('categories').get(),
    ]);
    const categoryNames = new Map(cats.docs.map((c) => [c.id, c.data().name]));

    const list = revs.docs.map((doc) => {
      const r = doc.data();
      return {
        id: doc.id,
        category_id: r.categoryId || '',
        category_name: categoryNames.get(r.categoryId) || '(deleted category)',
        name: r.name,
        text: r.text,
        rating: Number(r.rating) || 0,
        created_at: r.createdAt?.toDate?.().toISOString() ?? null,
        pinned: !!r.pinned,
        pinned_at: r.pinnedAt?.toDate?.().toISOString() ?? null,
      };
    });

    const time = (v) => (v ? Date.parse(v) : 0);
    list.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        time(b.pinned_at) - time(a.pinned_at) ||
        time(b.created_at) - time(a.created_at)
    );
    return res.status(200).json(list);
  }

  // ---------- pin / unpin, delete ----------
  const id = String(req.query.id || '');
  if (!id) throw httpError(400, 'Review id is required.');

  const ref = reviewsCol().doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, 'Review not found (it may already be deleted).');

  if (req.method === 'PATCH') {
    const { pinned } = await readJson(req);
    if (typeof pinned !== 'boolean') throw httpError(400, '"pinned" must be true or false.');

    await ref.update(
      pinned
        ? { pinned: true, pinnedAt: Timestamp.now() }
        : { pinned: false, pinnedAt: FieldValue.delete() }
    );
    return res.status(200).json({ success: true, pinned });
  }

  // DELETE
  await ref.delete();
  return res.status(200).json({ success: true });
});