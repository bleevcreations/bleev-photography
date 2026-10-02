# Bleeve Creations: Vercel + Firestore + Google Drive

Copy everything in this folder over your project root (same paths). Then delete `php/`, `about.php`,
`admin-about.php`, `update_about.php`, `remove_profile_picture.php` and move `uploads/` out of the repo
(keep it until the migration below has run). `existing-files.patch` is the same edits to your existing
files, for review only.

## 1. Google Drive (one time)
1. console.cloud.google.com -> new project -> **Enable "Google Drive API"**.
2. OAuth consent screen -> External -> fill the basics -> **Publish app** (In production). In "Testing" mode
   the refresh token dies after 7 days.
3. Credentials -> Create OAuth client ID -> type **Desktop app**. Copy client ID + secret into `.env`.
4. `npm install` then `npm run drive-token`, sign in with the Gmail that owns the Drive, and copy the
   printed `GOOGLE_REFRESH_TOKEN` into `.env`.

## 2. Firebase
1. Console -> Project settings -> Service accounts -> Generate new private key. Paste the JSON, on one line,
   into `FIREBASE_SERVICE_ACCOUNT`.
2. Firestore Database -> Create (if not already) -> Rules -> paste `firestore.rules`.
3. Set `ADMIN_EMAILS` to the email of your Firebase Auth admin user.

## 3. Migrate the dev data
Put `bleev_db.sql` and `uploads/` in the project root, then:
```
npm run migrate:dry     # preview: counts + any missing files
npm run migrate         # uploads photos to Drive, writes Firestore
```
Check Drive (`Bleeve Creations/<category>/`) and Firestore (`categories`, `reviews`, `about`).

## 4. Deploy
Push to GitHub -> import in Vercel -> add every variable from `.env.example` under Settings -> Environment
Variables -> deploy. `.vercelignore` keeps `uploads/`, `php/` and the SQL file out of the deploy.
