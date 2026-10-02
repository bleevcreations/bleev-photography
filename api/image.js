import { imageUrl, ROOT } from './_lib/cloudinary.js';
import { route, httpError } from './_lib/http.js';

// Only these widths are allowed, so visitors can't create endless Cloudinary variants.
const WIDTHS = [400, 800, 1200, 1600];

// GET /api/image?id=<publicId>          original photo (lightbox / full view)
// GET /api/image?id=<publicId>&w=800    resized, auto-format (category cards, slideshow)
// Redirects to Cloudinary's CDN; the redirect itself is cached at the edge.
export default route(async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_\-/]{5,200}$/.test(id) || id.includes('..') || !id.startsWith(`${ROOT}/`)) {
    throw httpError(400, 'Bad image id');
  }

  const requested = parseInt(req.query.w, 10);
  const width = requested > 0 ? WIDTHS.find((w) => w >= requested) || WIDTHS.at(-1) : undefined;

  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  res.setHeader('Location', imageUrl(id, width));
  res.status(302).end();
});