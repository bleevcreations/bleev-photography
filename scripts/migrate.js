// One-time migration: bleev_db.sql + uploads/  ->  Cloudinary + Firestore.
//   npm run migrate:dry     shows what would happen, changes nothing (no .env needed)
//   npm run migrate         does it  (photos go straight to Cloudinary)
// Options: --sql=bleev_db.sql  --uploads=uploads  --limit=5 (photos per category; --limit=0 = all)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const DRY = !!args.dry;
const SQL_FILE = args.sql || 'bleev_db.sql';
const UPLOADS = args.uploads || 'uploads';
const LIMIT = args.limit === undefined ? 5 : Number(args.limit);

// MySQL DATETIMEs in the dump have no timezone; XAMPP stored them in local (Nairobi) time.
const SOURCE_TZ = '+03:00';
const MAX_BYTES = 9 * 1024 * 1024; // Cloudinary's free plan rejects images over 10 MB
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// ---------- tiny parser for phpMyAdmin "INSERT ... VALUES (...),(...);" ----------
function parseInserts(sql, table) {
  const m = new RegExp('INSERT INTO `' + table + '` \\(([^)]*)\\) VALUES', 'i').exec(sql);
  if (!m) return [];
  const cols = m[1].split(',').map((s) => s.replace(/[`\s]/g, ''));
  let i = m.index + m[0].length;
  const rows = [];
  while (i < sql.length) {
    while (/[\s,]/.test(sql[i])) i++;
    if (sql[i] === ';') break;
    if (sql[i] !== '(') throw new Error(`SQL parse error near: ${sql.slice(i, i + 40)}`);
    i++;
    const vals = [];
    for (;;) {
      while (/\s/.test(sql[i])) i++;
      if (sql[i] === "'") {
        i++;
        let s = '';
        for (;;) {
          const c = sql[i];
          if (c === '\\') {
            const n = sql[i + 1];
            s += { n: '\n', r: '\r', t: '\t', 0: '\0' }[n] ?? n;
            i += 2;
          } else if (c === "'") {
            if (sql[i + 1] === "'") { s += "'"; i += 2; } else { i++; break; }
          } else { s += c; i++; }
        }
        vals.push(s);
      } else {
        let j = i;
        while (!/[,)]/.test(sql[j])) j++;
        const tok = sql.slice(i, j).trim();
        vals.push(tok === 'NULL' ? null : Number(tok));
        i = j;
      }
      while (/\s/.test(sql[i])) i++;
      if (sql[i] === ',') { i++; continue; }
      if (sql[i] === ')') { i++; break; }
      throw new Error(`SQL parse error near: ${sql.slice(i, i + 40)}`);
    }
    rows.push(Object.fromEntries(cols.map((c, k) => [c, vals[k]])));
  }
  return rows;
}

const toDate = (s) => new Date(String(s).replace(' ', 'T') + SOURCE_TZ);

function findLocal(rel) {
  const clean = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
  const [folder, ...rest] = clean.split('/');
  const candidates = [
    clean,
    [folder.replace(/ /g, '_'), ...rest].join('/'),
    [folder.replace(/_/g, ' '), ...rest].join('/'),
  ];
  for (const c of candidates) {
    const p = path.join(UPLOADS, c);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

// Returns { buffer, name, mimeType } or null if the file can't be used.
async function prepare(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let name = path.basename(filePath);
  let buffer = fs.readFileSync(filePath);
  let mimeType = MIME[ext];
  if (!mimeType) return null;

  if (buffer.length > MAX_BYTES) {
    if (!sharp) { console.warn(`  ! ${name} is over 9 MB and sharp isn't installed - skipped`); return null; }
    for (const quality of [85, 75, 65]) {
      buffer = await sharp(fs.readFileSync(filePath))
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
      if (buffer.length <= MAX_BYTES) break;
    }
    mimeType = 'image/jpeg';
    name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  return { buffer, name, mimeType };
}

// ---------------------------------- run ----------------------------------
const sql = fs.readFileSync(SQL_FILE, 'utf8');
const categories = parseInserts(sql, 'portfolio_categories');
const reviews = parseInserts(sql, 'reviews');
const about = parseInserts(sql, 'about_page')[0];

console.log(`${DRY ? '[DRY RUN] ' : ''}Found ${categories.length} categories, ${reviews.length} reviews, ${about ? 1 : 0} about row.\n`);

let lib = null;
if (!DRY) {
  lib = {
    ...(await import('../api/_lib/firebase.js')),
    ...(await import('../api/_lib/cloudinary.js')),
  };
}

for (const cat of categories) {
  let rels = [];
  try { rels = JSON.parse(cat.images || '[]'); } catch { console.warn(`  ! bad images JSON for "${cat.name}"`); }

  // The old add-images.php could list the same photo several times; keep each file once.
  const found = [];
  const missing = [];
  for (const rel of rels) {
    const p = findLocal(rel);
    if (!p) missing.push(rel);
    else if (!found.includes(p)) found.push(p);
  }
  const dupes = rels.length - found.length - missing.length;
  const toUpload = LIMIT > 0 ? found.slice(0, LIMIT) : found;
  console.log(
    `${cat.name} (id ${cat.id}): ${found.length} photos found, ${missing.length} missing, migrating ${toUpload.length}` +
      (dupes > 0 ? `, ${dupes} duplicate entries ignored` : '')
  );
  missing.forEach((m) => console.log(`    missing: ${m}`));
  if (DRY) continue;

  const ref = lib.db().collection('categories').doc(String(cat.id));
  if ((await ref.get()).exists) {
    console.log('    already migrated - skipping (delete the Firestore doc + its Cloudinary photos to redo)');
    continue;
  }

  const images = [];
  for (const p of toUpload) {
    const prepared = await prepare(p);
    if (!prepared) { console.warn(`    skipped unsupported file: ${p}`); continue; }
    const publicId = await lib.uploadImage({
      folder: `categories/${cat.id}`,
      name: prepared.name,
      buffer: prepared.buffer,
    });
    images.push({ publicId, name: prepared.name });
    process.stdout.write('.');
  }
  await ref.set({
    name: cat.name,
    price: cat.price || '',
    description: cat.description || '',
    images,
    createdAt: lib.Timestamp.fromDate(toDate(cat.created_at || '2025-05-24 00:00:00')),
  });
  console.log(`\n    uploaded ${images.length}`);
}

if (!DRY) {
  for (const r of reviews) {
    await lib.db().collection('reviews').doc(String(r.id)).set({
      categoryId: String(r.category_id),
      name: r.name,
      text: r.text,
      rating: r.rating || 0,
      createdAt: lib.Timestamp.fromDate(toDate(r.created_at)),
    });
  }
  console.log(`Reviews migrated: ${reviews.length}`);

  if (about) {
    const data = { description: about.description || '' };
    const pic = about.profile_picture && findLocal(about.profile_picture);
    if (pic) {
      const prepared = await prepare(pic);
      if (prepared) {
        data.profilePicturePublicId = await lib.uploadImage({
          folder: 'about',
          name: prepared.name,
          buffer: prepared.buffer,
        });
      }
    }
    await lib.db().collection('about').doc('main').set(data);
    console.log('About page migrated.');
  }
}
console.log('\nDone.');