// One-time copy of the photos already in Google Drive -> Cloudinary.
//   node scripts/drive-to-cloudinary.js --dry    lists what would be copied, changes nothing
//   node scripts/drive-to-cloudinary.js          copies
//
// Safe to run more than once, and safe while the old deployment is still live: it only ADDS a
// `publicId` next to each image's existing `fileId`, so the old (Drive) code keeps working until
// the new deployment goes out. Entries that already have a publicId are skipped.
import 'dotenv/config';

const DRY = process.argv.includes('--dry');

const { db } = await import('../api/_lib/firebase.js');
const { downloadFile } = await import('../api/_lib/drive.js');
const { uploadImage } = await import('../api/_lib/cloudinary.js');

async function copyOne(driveId, folder, name) {
  const res = await downloadFile(driveId);
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type})`);
  return uploadImage({ folder, name, buffer: Buffer.from(await res.arrayBuffer()) });
}

let copied = 0;
let failed = 0;

for (const doc of (await db().collection('categories').get()).docs) {
  const data = doc.data();
  const images = data.images || [];
  const todo = images.filter((i) => i.fileId && !i.publicId).length;
  console.log(`${data.name} (${doc.id}): ${images.length} photos, ${todo} to copy`);
  if (DRY || !todo) continue;

  const next = [];
  for (const img of images) {
    if (img.publicId || !img.fileId) { next.push(img); continue; }
    try {
      const publicId = await copyOne(img.fileId, `categories/${doc.id}`, img.name || 'photo');
      next.push({ ...img, publicId });
      copied++;
      process.stdout.write('.');
    } catch (err) {
      console.warn(`\n    ! ${img.name || img.fileId}: ${err.message}`);
      next.push(img);
      failed++;
    }
  }
  await doc.ref.update({ images: next }); // written per category so a crash loses little
  console.log();
}

const aboutRef = db().collection('about').doc('main');
const about = (await aboutRef.get()).data() || {};
if (about.profilePicture && !about.profilePicturePublicId) {
  console.log('About page: profile picture to copy');
  if (!DRY) {
    try {
      const publicId = await copyOne(about.profilePicture, 'about', 'profile');
      await aboutRef.set({ profilePicturePublicId: publicId }, { merge: true });
      copied++;
    } catch (err) {
      console.warn(`  ! profile picture: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n${DRY ? '[DRY RUN] ' : ''}Copied ${copied}, failed ${failed}. Re-run to retry failures.`);