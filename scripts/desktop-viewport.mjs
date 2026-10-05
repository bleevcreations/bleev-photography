// Makes the public pages open in "Desktop site" mode on phones.
//   node scripts/desktop-viewport.mjs --dry     shows what it would change
//   node scripts/desktop-viewport.mjs           edits the pages
//   node scripts/desktop-viewport.mjs --undo    puts back the normal mobile-friendly setting
//
// Run from the project root. It only touches the .html files in the root folder (the public
// pages). The admin pages in /admin are left alone.
import fs from 'node:fs';

const WIDTH = 1366; // the desktop width phones will pretend to have
const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');

const wanted = UNDO
  ? '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  : `<meta name="viewport" content="width=${WIDTH}">`;
const re = /<meta\s+name=["']viewport["'][^>]*>/i;

const files = fs.readdirSync('.').filter((f) => f.endsWith('.html'));
if (!files.length) {
  console.error('No .html files here. Run this from the project root.');
  process.exit(1);
}

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  if (!re.test(raw)) {
    console.log(`MISSING ${f}  (no viewport tag found, add one in the <head> by hand)`);
    continue;
  }
  if (raw.match(re)[0] === wanted) {
    console.log(`skip    ${f} (already set)`);
    continue;
  }
  console.log(`${DRY ? '[dry] ' : ''}update  ${f}`);
  if (!DRY) fs.writeFileSync(f, raw.replace(re, wanted));
}
console.log(DRY ? '\nDry run only, nothing was changed.' : '\nDone.');
