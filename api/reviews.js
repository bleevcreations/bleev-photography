import { db, Timestamp } from './_lib/firebase.js';
import {
  route,
  readJson,
  httpError,
  methodNotAllowed,
} from './_lib/http.js';

const reviewsCol = () =>
  db().collection('reviews');

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

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get('month')} ${get('day')}, ${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j =
      Math.floor(Math.random() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

const toReview = (d) => ({
  name: d.name,
  text: d.text,
  rating: Number(d.rating) || 0,
  date: d.createdAt?.toDate ? formatDate(d.createdAt.toDate()) : '',
});

export default route(async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    /*
     * =======================================================
     * GET /api/reviews?random=1
     *
     * RANDOM REVIEWS PAGE
     *
     * Returns ALL reviews in random order.
     *
     * Category information is intentionally
     * excluded from the response.
     * =======================================================
     */

    if (req.query.random) {
      const snap =
        await reviewsCol().get();

      const allReviews =
        snap.docs.map((doc) => doc.data());

// pinned reviews first (most recently pinned on top),
      // everything else in random order
      const time = (t) => t?.toMillis?.() ?? 0;

      const pinnedReviews = allReviews
        .filter((review) => review.pinned)
        .sort((a, b) => time(b.pinnedAt) - time(a.pinnedAt));

      const shuffledReviews = [
        ...pinnedReviews,
        ...shuffle(allReviews.filter((review) => !review.pinned)),
      ];

      return res
        .status(200)
        .json(
          shuffledReviews.map((review) => ({
            name: review.name,
            text: review.text,
            rating:
              Number(review.rating) || 0,
            created_at:
              review.createdAt?.toDate?.().toISOString() ?? null,
                pinned: !!review.pinned,
          }))
        );
    }


    /*
     * =======================================================
     * GET /api/reviews?category_id=..
     *
     * CATEGORY PAGE
     *
     * Returns:
     * - 5 most recent reviews
     * - 5 random older reviews
     *
     * THIS LOGIC REMAINS UNCHANGED.
     * =======================================================
     */

    const categoryId = String(
      req.query.category_id || ''
    );

    if (!categoryId) {
      return res
        .status(200)
        .json([]);
    }

    const snap =
      await reviewsCol()
        .where(
          'categoryId',
          '==',
          categoryId
        )
        .get();

    const all =
      snap.docs
        .map((doc) => doc.data())
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) -
            (a.createdAt?.toMillis?.() ?? 0)
        );

    const recent =
      all.slice(0, 5);

    const random =
      shuffle(
        all.slice(5)
      ).slice(0, 5);

    return res
      .status(200)
      .json(
        [...recent, ...random]
          .map(toReview)
      );
  }


  /*
   * =========================================================
   * POST /api/reviews
   *
   * CREATE REVIEW
   * =========================================================
   */

  if (req.method === 'POST') {
    const body =
      await readJson(req);

    const name =
      String(
        body.name || ''
      ).trim();

    const text =
      String(
        body.text || ''
      ).trim();

    const categoryId =
      String(
        body.category_id || ''
      ).trim();

    let rating =
      parseInt(
        body.rating,
        10
      );

    if (
      !name ||
      !text ||
      !rating ||
      !categoryId
    ) {
      throw httpError(
        400,
        'Missing fields'
      );
    }

    if (name.length > 100) {
      throw httpError(
        400,
        'Name is too long.'
      );
    }

    if (text.length > 1000) {
      throw httpError(
        400,
        'Review is too long (max 1000 characters).'
      );
    }

    rating =
      Math.max(
        1,
        Math.min(5, rating)
      );

    const cat =
      await db()
        .collection('categories')
        .doc(categoryId)
        .get();

    if (!cat.exists) {
      throw httpError(
        404,
        'Category not found'
      );
    }

    await reviewsCol().add({
      categoryId,
      name,
      text,
      rating,
      createdAt:
        Timestamp.now(),
    });

    return res
      .status(200)
      .json({
        success: true,
        message:
          'Thank you for your review!',
      });
  }

  throw methodNotAllowed();
});