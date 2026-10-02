import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { httpError } from './http.js';

function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  initializeApp({ credential: cert(JSON.parse(raw)) });
}

export function db() {
  init();
  return getFirestore();
}

export { FieldValue, Timestamp };

// Verifies the Firebase ID token sent by the admin pages and checks the email.
export async function requireAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw httpError(401, 'Please log in first.');

  init();
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    throw httpError(401, 'Session expired. Please log in again.');
  }

  const allowed = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!decoded.email || !allowed.includes(decoded.email.toLowerCase())) {
    throw httpError(403, 'This account is not allowed to manage the site.');
  }
  return decoded;
}
