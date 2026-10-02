import {
  db,
  FieldValue,
  requireAdmin,
} from './_lib/firebase.js';

import {
  uploadImage,
  deleteImage,
} from './_lib/cloudinary.js';

import {
  route,
  readBody,
  readJson,
  httpError,
  methodNotAllowed,
} from './_lib/http.js';

const ref = () =>
  db().collection('about').doc('main');

const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

function snippet(text) {
  const value = String(text || '');

  const cut = value.slice(
    0,
    Math.floor(value.length * 0.4)
  );

  return cut.replace(/\s+\S*$/, '...').trim();
}

// GET /api/about
// Public:
// {
//   description,
//   snippet,
//   profilePicture
// }

// PUT /api/about
// Admin:
// { description }

// POST /api/about?name=me.jpg
// Admin:
// Raw image body -> new profile picture

// DELETE /api/about
// Admin:
// Removes the profile picture

export default route(async (req, res) => {
  /*
   * ---------------------------------------------------------
   * GET
   * ---------------------------------------------------------
   */

  if (req.method === 'GET') {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    const d =
      (await ref().get()).data() || {};

    return res.status(200).json({
      description: d.description || '',

      snippet: d.description
        ? snippet(d.description)
        : 'No description found.',

      profilePicture:
        d.profilePicturePublicId || null,
    });
  }

  /*
   * ---------------------------------------------------------
   * ADMIN METHODS
   * ---------------------------------------------------------
   */

  if (
    !['PUT', 'POST', 'DELETE'].includes(
      req.method
    )
  ) {
    throw methodNotAllowed();
  }

  await requireAdmin(req);

  const current =
    (await ref().get()).data() || {};

  /*
   * ---------------------------------------------------------
   * PUT - UPDATE DESCRIPTION
   * ---------------------------------------------------------
   */

  if (req.method === 'PUT') {
    const { description } =
      await readJson(req);

    if (
      typeof description !== 'string' ||
      description.length > 5000
    ) {
      throw httpError(
        400,
        'Description is missing or too long.'
      );
    }

    await ref().set(
      {
        description,
      },
      {
        merge: true,
      }
    );

    return res.status(200).json({
      success: true,
    });
  }

  /*
   * ---------------------------------------------------------
   * POST - UPLOAD PROFILE PICTURE
   * ---------------------------------------------------------
   */

  if (req.method === 'POST') {
    const mimeType = String(
      req.headers['content-type'] || ''
    )
      .split(';')[0]
      .trim();

    if (!ALLOWED.includes(mimeType)) {
      throw httpError(
        415,
        'Only JPEG, PNG or WebP images are allowed.'
      );
    }

    const buffer = await readBody(req);

    if (!buffer.length) {
      throw httpError(
        400,
        'Empty image file.'
      );
    }

    const publicId = await uploadImage({
      folder: 'about',
      name:
        req.query.name ||
        'profile.jpg',
      buffer,
    });

    /*
     * Delete the old profile picture only
     * after the new upload succeeds.
     */
    if (
      current.profilePicturePublicId
    ) {
      await deleteImage(
        current.profilePicturePublicId
      );
    }

    await ref().set(
      {
        profilePicturePublicId:
          publicId,
      },
      {
        merge: true,
      }
    );

    return res.status(200).json({
      success: true,
      profilePicture: publicId,
    });
  }

  /*
   * ---------------------------------------------------------
   * DELETE - REMOVE PROFILE PICTURE
   * ---------------------------------------------------------
   */

  if (
    current.profilePicturePublicId
  ) {
    await deleteImage(
      current.profilePicturePublicId
    );
  }

  await ref().set(
    {
      profilePicturePublicId:
        FieldValue.delete(),
    },
    {
      merge: true,
    }
  );

  return res.status(200).json({
    success: true,
  });
});