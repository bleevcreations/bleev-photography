// One-time tidy-up: moves photos that are loose in the Cloudinary root into
//   bleev/categories/<categoryId>/   and   bleev/about/
//   node scripts/organize-cloudinary-folders.js --dry    shows what would move, changes nothing
//   node scripts/organize-cloudinary-folders.js          moves them
//
// Only the Media Library folder changes. Public IDs stay the same, so the website and Firestore
// are not affected. Safe to re-run.
import 'dotenv/config';

const DRY = process.argv.includes('--dry');

const { db } = await import('../api/_lib/firebase.js');
const { ROOT } = await import('../api/_lib/cloudinary.js');
const { v2: cloudinary } = await import('cloudinary'); // already configured by the import above

let moved = 0;
let failed = 0;

async function move(publicId, folder) {
  if (DRY) {
    console.log(`  would move ${publicId} -> ${folder}`);
    return;
  }
  try {
    await cloudinary.api.update(publicId, { asset_folder: folder, resource_type: 'image' });
    moved++;
    process.stdout.write('.');
  } catch (err) {
    failed++;
    const msg = err?.error?.message || err.message;
    console.warn(`\n  ! ${publicId}: ${msg}`);
    if (err?.error?.http_code === 420 || err?.http_code === 420) {
      console.warn('  Cloudinary rate limit reached (free plan: 500 Admin API calls/hour). Wait an hour and re-run.');
      process.exit(1);
    }
  }
}

for (const doc of (await db().collection('categories').get()).docs) {
  const data = doc.data();
  const ids = (data.images || []).map((i) => i.publicId).filter(Boolean);
  console.log(`${data.name} (${doc.id}): ${ids.length} photos`);
  for (const id of ids) await move(id, `${ROOT}/categories/${doc.id}`);
  if (!DRY && ids.length) console.log();
}

const about = (await db().collection('about').doc('main').get()).data() || {};
if (about.profilePicturePublicId) {
  console.log('About page: profile picture');
  await move(about.profilePicturePublicId, `${ROOT}/about`);
  if (!DRY) console.log();
}

console.log(`\n${DRY ? '[DRY RUN] ' : ''}Moved ${moved}, failed ${failed}.`);