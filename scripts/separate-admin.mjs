// One-time restructure: moves the admin pages into their own /admin folder and removes
// the public "Admin" link.
//   node scripts/separate-admin.mjs --dry    shows what it would do, changes nothing
//   node scripts/separate-admin.mjs          does it
//
// Run it from the project root. It edits YOUR current files in place (so your Firebase
// config edits are kept) and is safe to re-run: steps that are already done are skipped.
//
// Result:
//   /admin/login.html   /admin/panel.html   /admin/about.html
//   /admin/js/auth.js   /admin/js/panel.js
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const root = process.cwd();
const abs = (rel) => path.join(root, ...rel.split('/'));
const exists = (rel) => fs.existsSync(abs(rel));

if (!exists('homepage.html') || !exists('api') || !exists('vercel.json')) {
  console.error('Run this from the project root (the folder that contains homepage.html and api/).');
  process.exit(1);
}

const note = (msg) => console.log(`${DRY ? '[dry] ' : ''}${msg}`);

// ---------------------------------------------------------------- 1. move files
const moves = [
  ['admin-login.html', 'admin/login.html'],
  ['admin-panel.html', 'admin/panel.html'],
  ['admin-about.html', 'admin/about.html'],
  ['js/admin-auth.js', 'admin/js/auth.js'],
  ['js/admin-panel.js', 'admin/js/panel.js'],
];

for (const [from, to] of moves) {
  if (exists(to)) {
    note(`skip   ${from} (already at ${to})`);
    continue;
  }
  if (!exists(from)) {
    note(`MISSING ${from}  (not found, nothing to move)`);
    continue;
  }
  note(`move   ${from}  ->  ${to}`);
  if (!DRY) {
    fs.mkdirSync(path.dirname(abs(to)), { recursive: true });
    fs.renameSync(abs(from), abs(to));
  }
}

// ---------------------------------------------------------------- 2. fix paths
// In dry mode the files haven't moved, so read them from where they are now.
const where = (to) => (DRY ? moves.find(([, t]) => t === to)?.[0] ?? to : to);

const edits = {
  'admin/login.html': [
    ['href="assets/logos/favicon.png"', 'href="../assets/logos/favicon.png"'],
    ["url('assets/logos/logo2.jpg')", "url('../assets/logos/logo2.jpg')"],
    ['window.location.href = "admin-panel.html"', 'window.location.href = "/admin/panel.html"'],
  ],
  'admin/panel.html': [
    ['href="assets/logos/favicon.png"', 'href="../assets/logos/favicon.png"'],
    ['href="css/style.css"', 'href="../css/style.css"'],
    ['href="admin-about.html"', 'href="about.html"'],
    ['href="homepage.html"', 'href="../homepage.html"'],
    ['src="js/admin-auth.js"', 'src="js/auth.js"'],
    ['src="js/admin-panel.js"', 'src="js/panel.js"'],
  ],
  'admin/about.html': [
    ['href="assets/logos/favicon.png"', 'href="../assets/logos/favicon.png"'],
    ['href="admin-panel.html"', 'href="panel.html"'],
    ['src="js/admin-auth.js"', 'src="js/auth.js"'],
  ],
  'admin/js/auth.js': [
    ['window.location.replace("admin-login.html")', 'window.location.replace("/admin/login.html")'],
    ['Shared by admin-panel.html and admin-about.html.', 'Shared by admin/panel.html and admin/about.html.'],
    ['to admin-login.html', 'to /admin/login.html'],
  ],
};

for (const [file, pairs] of Object.entries(edits)) {
  const src = where(file);
  if (!exists(src)) continue;
  let text = fs.readFileSync(abs(src), 'utf8');
  for (const [from, to] of pairs) {
    const n = text.split(from).length - 1;
    if (n === 0) {
      note(`  (no change) ${file}: ${from}`);
      continue;
    }
    text = text.split(from).join(to);
    note(`  fix    ${file}: ${from}  ->  ${to}${n > 1 ? `  (x${n})` : ''}`);
  }
  if (!DRY) fs.writeFileSync(abs(file), text);
}

// ---------------------------------------------------------------- 3. public Admin link
{
  const file = 'homepage.html';
  let text = fs.readFileSync(abs(file), 'utf8');
  const re = /^[ \t]*<li><a href="admin-login\.html">Admin<\/a><\/li>[ \t]*\r?\n/m;
  if (re.test(text)) {
    note(`remove the public Admin link from ${file}`);
    if (!DRY) fs.writeFileSync(abs(file), text.replace(re, ''));
  } else {
    note(`  (no change) ${file}: Admin link already gone`);
  }
}

// ---------------------------------------------------------------- 4. vercel.json
{
  const file = 'vercel.json';
  const cfg = JSON.parse(fs.readFileSync(abs(file), 'utf8'));
  let changed = false;

  const ensure = (key, entries, same) => {
    cfg[key] = cfg[key] || [];
    for (const e of entries) {
      if (!cfg[key].some((x) => same(x, e))) {
        cfg[key].push(e);
        changed = true;
      }
    }
  };

  // /admin -> login page
  ensure('rewrites', [{ source: '/admin', destination: '/admin/login.html' }], (a, b) => a.source === b.source);
  // old bookmarks keep working
  ensure(
    'redirects',
    [
      { source: '/admin-login.html', destination: '/admin/login.html', permanent: false },
      { source: '/admin-panel.html', destination: '/admin/panel.html', permanent: false },
      { source: '/admin-about.html', destination: '/admin/about.html', permanent: false },
    ],
    (a, b) => a.source === b.source
  );
  // keep search engines away from the admin area
  ensure(
    'headers',
    [{ source: '/admin/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }],
    (a, b) => a.source === b.source
  );

  if (changed) {
    note('update vercel.json (/admin rewrite, redirects from the old URLs, noindex header)');
    if (!DRY) fs.writeFileSync(abs(file), JSON.stringify(cfg, null, 2) + '\n');
  } else {
    note('  (no change) vercel.json already set up');
  }
}

console.log(`\n${DRY ? 'Dry run only, nothing was changed.' : 'Done.'}`);
