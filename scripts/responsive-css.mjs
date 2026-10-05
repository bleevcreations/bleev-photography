// One-time CSS update: makes the cover image, portfolio cards and grids scale with the screen.
//   node scripts/responsive-css.mjs --dry    shows what it would change, changes nothing
//   node scripts/responsive-css.mjs          edits css/style.css
//
// Run from the project root. It edits YOUR css/style.css in place, ignoring spacing/blank-line
// differences, and reports any edit it could not find. Safe to re-run: finished edits are skipped.
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const FILE = 'css/style.css';
if (!fs.existsSync(FILE)) {
  console.error(`Run this from the project root (could not find ${FILE}).`);
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf8');
const crlf = raw.includes('\r\n');
let css = raw.replace(/\r\n/g, '\n');

// Match text ignoring whitespace differences.
const rx = (text) =>
  new RegExp(
    text.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
    'g'
  );

let applied = 0, skipped = 0, missing = 0;

function edit(name, oldText, newText) {
  const re = rx(oldText);
  const n = (css.match(re) || []).length;
  if (n === 1) {
    console.log(`${DRY ? '[dry] ' : ''}apply   ${name}`);
    css = css.replace(re, () => newText.trim());
    applied++;
  } else if (n === 0 && newText.trim() && rx(newText).test(css)) {
    console.log(`skip    ${name} (already done)`);
    skipped++;
  } else {
    console.log(`MISSING ${name}  (${n} matches, expected 1) - edit this one by hand`);
    missing++;
  }
}
// Removing an old override: if it is not there, that is fine (already removed or never existed).
function drop(name, oldText) {
  const re = rx(oldText);
  const n = (css.match(re) || []).length;
  if (n === 1) {
    console.log(`${DRY ? '[dry] ' : ''}remove  ${name}`);
    css = css.replace(re, () => '');
    applied++;
  } else if (n === 0) {
    console.log(`skip    ${name} (not found, fine if already removed)`);
    skipped++;
  } else {
    console.log(`MISSING ${name}  (${n} matches, expected 1) - remove this one by hand`);
    missing++;
  }
}

// ------------------------------------------------ one variable for the navbar height
edit('root variable + body offset', `
body {
  font-family: "Segoe UI", Arial, sans-serif;
  background: #fff;
  color: #222;
  line-height: 1.6;
  padding-top: 80px;
}`, `
:root {
  --nav-h: 80px;   /* navbar height: body offset and hero height both use this */
}

html {
  -webkit-text-size-adjust: 100%;   /* stop phones from inflating text */
}

body {
  font-family: "Segoe UI", Arial, sans-serif;
  background: #fff;
  color: #222;
  line-height: 1.6;
  padding-top: var(--nav-h);
}`);
edit('700px: body offset', `body { padding-top: 70px; }`, `:root { --nav-h: 70px; }`);
edit('480px: body offset', `body { padding-top: 90px; }`, `:root { --nav-h: 90px; }`);

// ------------------------------------------------ navbar is exactly --nav-h tall
edit('navbar height', `color: #fff; padding: 15px 40px; position: fixed;`,
  `color: #fff;
  padding: 0 40px;
  height: var(--nav-h);

  position: fixed;`);
edit('700px: navbar padding', `.navbar { padding: 13px 20px; }`, `.navbar { padding: 0 20px; }`);
edit('480px: navbar', `.navbar { flex-direction: column; gap: 8px; padding: 10px 12px; }`,
  `.navbar {
    flex-direction: column;
    justify-content: center;

    gap: 8px;

    padding: 0 12px;
  }`);

// ------------------------------------------------ hero: whole image always visible
edit('hero', `
  background:
    url("../assets/images/cover.png")
    no-repeat center center / cover;

  height: calc(100vh - 80px);
  min-height: 600px;`, `
  /* The whole cover image is always visible (never cropped).
     The gradient behind it matches the image's dark edges. */
  background:
    url("../assets/images/cover.png") no-repeat center / contain,
    linear-gradient(to right, #181b1e 50%, #0d0e12 50%);

  /* 56.25vw = 16:9, the image's own shape. On short, wide screens the
     height is capped so the banner still fits under the navbar. */
  height: min(56.25vw, calc(100vh - var(--nav-h)));
  height: min(56.25vw, calc(100svh - var(--nav-h)));`);
drop('700px: hero override', `.hero { height: calc(100vh - 70px); min-height: 500px; }`);
drop('480px: hero override', `.hero { height: calc(100vh - 90px); }`);

// ------------------------------------------------ portfolio grid and cards
edit('portfolio grid', `grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;`,
  `/* as many columns as fit: 1 on phones, up to 4 on wide screens */
  grid-template-columns:
    repeat(auto-fill, minmax(min(100%, 280px), 1fr));

  gap: 16px;`);
edit('card width', `width: 102.5%;`, `width: 100%;`);
edit('card shape', `height: 280px;`,
  `aspect-ratio: 4 / 3;          /* same shape on every screen */
  container-type: inline-size;  /* lets the text below scale with the card */`);
edit('card overlay padding', `align-items: flex-start; padding: 35px; z-index: 2;`,
  `align-items: flex-start;

  padding: clamp(14px, 7cqi, 30px);

  z-index: 2;`);
edit('category name size', `font-size: clamp(0.85rem, 1.3vw, 1.2rem);`, `font-size: clamp(1rem, 6cqi, 1.5rem);`);
edit('photo count size', `font-size: 10px; font-weight: 500;`, `font-size: clamp(9px, 3cqi, 12px);
  font-weight: 500;`);

drop('1200px: grid columns', `.portfolio-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }`);
drop('1200px: card height', `.portfolio-card { height: 440px; }`);
edit('800px: grid + card overrides', `
  .portfolio-grid { grid-template-columns: 1fr; gap: 20px; }
  .portfolio-card { height: 500px; }
  .portfolio-category-name { font-size: 2rem; }
  .portfolio-photo-count { opacity: 1; transform: none; }`, `
  .portfolio-grid {
    gap: 20px;
  }`);
drop('560px: card height', `.portfolio-card { height: 430px; }`);
drop('560px: overlay padding', `.portfolio-card-overlay { padding: 25px; }`);
drop('560px: name size', `.portfolio-category-name { font-size: 1.8rem; }`);
drop('480px: single column', `.portfolio-grid { grid-template-columns: 1fr; }`);

// ------------------------------------------------ category gallery + services
edit('gallery grid', `grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px;`,
  `grid-template-columns:
    repeat(auto-fill, minmax(min(100%, 320px), 1fr));

  gap: 18px;`);
edit('services grid', `grid-template-columns: repeat(3, 1fr); gap: 2rem;`,
  `grid-template-columns:
    repeat(auto-fit, minmax(min(100%, 260px), 1fr));

  gap: 2rem;`);
drop('1000px: gallery + services columns', `
@media (max-width: 1000px) {
  .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .services-grid { grid-template-columns: repeat(2, 1fr); }
}`);
edit('700px: gallery grid', `.gallery-grid { grid-template-columns: 1fr; gap: 12px; }`, `.gallery-grid { gap: 12px; }`);
drop('700px: services grid', `.services-grid { grid-template-columns: 1fr; }`);

// ------------------------------------------------ write
console.log(`\n${applied} applied, ${skipped} already done, ${missing} not found.`);
if (!DRY && applied) {
  fs.writeFileSync(FILE, (crlf ? css.replace(/\n/g, '\r\n') : css).replace(/\n{4,}/g, '\n\n\n'));
  console.log(`${FILE} updated.`);
} else if (DRY) {
  console.log('Dry run only, nothing was changed.');
}
