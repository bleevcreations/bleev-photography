import { db, Timestamp } from './_lib/firebase.js';
import { route, readJson, httpError, methodNotAllowed } from './_lib/http.js';

const reviewsCol = () => db().collection('reviews');

function formatDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('month')} ${get('day')}, ${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toReview = (d) => ({
  name: d.name,
  text: d.text,
  rating: Number(d.rating) || 0,
  date: formatDate(d.createdAt.toDate()),
});

export default route(async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    // GET /api/reviews?random=1  -> one random review from up to 10 random categories
    if (req.query.random) {
      const [cats, revs] = await Promise.all([
        db().collection('categories').get(),
        reviewsCol().get(),
      ]);
      const byCategory = new Map();
      for (const r of revs.docs) {
        const d = r.data();
        if (!byCategory.has(d.categoryId)) byCategory.set(d.categoryId, []);
        byCategory.get(d.categoryId).push(d);
      }
      const out = [];
      for (const cat of shuffle(cats.docs).slice(0, 10)) {
        const list = byCategory.get(cat.id);
        if (!list?.length) continue;
        const pick = list[Math.floor(Math.random() * list.length)];
        out.push({
          category_id: cat.id,
          category_name: cat.data().name,
          review: {
            name: pick.name,
            text: pick.text,
            rating: Number(pick.rating) || 0,
            created_at: pick.createdAt.toDate().toISOString(),
          },
        });
      }
      return res.status(200).json(out);
    }

    // GET /api/reviews?category_id=..  -> 5 most recent + 5 random others
    const categoryId = String(req.query.category_id || '');
    if (!categoryId) return res.status(200).json([]);

    const snap = await reviewsCol().where('categoryId', '==', categoryId).get();
    const all = snap.docs
      .map((d) => d.data())
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const recent = all.slice(0, 5);
    const random = shuffle(all.slice(5)).slice(0, 5);
    return res.status(200).json([...recent, ...random].map(toReview));
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const text = String(body.text || '').trim();
    const categoryId = String(body.category_id || '').trim();
    let rating = parseInt(body.rating, 10);

    if (!name || !text || !rating || !categoryId) throw httpError(400, 'Missing fields');
    if (name.length > 100) throw httpError(400, 'Name is too long.');
    if (text.length > 1000) throw httpError(400, 'Review is too long (max 1000 characters).');
    rating = Math.max(1, Math.min(5, rating));

    const cat = await db().collection('categories').doc(categoryId).get();
    if (!cat.exists) throw httpError(404, 'Category not found');

    await reviewsCol().add({ categoryId, name, text, rating, createdAt: Timestamp.now() });
    return res.status(200).json({ success: true, message: 'Thank you for your review!' });
  }

  throw methodNotAllowed();
});
