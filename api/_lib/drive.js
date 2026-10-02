import { OAuth2Client } from 'google-auth-library';
import { httpError } from './http.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

let oauth;
let rootId;

async function accessToken() {
  if (!oauth) {
    oauth = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  }
  const { token } = await oauth.getAccessToken();
  return token;
}

async function driveFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${await accessToken()}`,
    },
  });
}

async function asJson(res, what) {
  if (!res.ok) {
    console.error('Drive error:', what, res.status, await res.text());
    throw httpError(502, `Google Drive error while ${what}`);
  }
  return res.json();
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
export const safeName = (s) =>
  String(s).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 120) || 'untitled';

export async function ensureFolder(name, parentId) {
  const q =
    `mimeType='${FOLDER}' and trashed=false and name='${esc(name)}'` +
    (parentId ? ` and '${parentId}' in parents` : " and 'root' in parents");
  const found = await asJson(
    await driveFetch(
      `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`
    ),
    'looking up a folder'
  );
  if (found.files?.length) return found.files[0].id;

  const created = await asJson(
    await driveFetch(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: FOLDER,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    }),
    'creating a folder'
  );
  return created.id;
}

export async function rootFolderId() {
  if (!rootId) {
    rootId = await ensureFolder(
      process.env.DRIVE_ROOT_FOLDER_NAME || 'Bleev Creations'
    );
  }
  return rootId;
}

export async function categoryFolder(name) {
  return ensureFolder(safeName(name), await rootFolderId());
}

export async function renameFile(id, name) {
  await asJson(
    await driveFetch(`${API}/files/${id}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
    'renaming a file'
  );
}

export async function uploadFile({ name, mimeType, buffer, parentId }) {
  const boundary = `bleev${Date.now()}${Math.random().toString(16).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [parentId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return asJson(
    await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
    'uploading a file'
  );
}

// Deleting a folder also deletes everything inside it.
export async function deleteFile(id) {
  const res = await driveFetch(`${API}/files/${id}`, { method: 'DELETE' });
  if (res.ok || res.status === 404) return;
  console.error('Drive delete failed', res.status, await res.text());
  throw httpError(502, 'Google Drive error while deleting');
}

export async function downloadFile(id) {
  return driveFetch(`${API}/files/${id}?alt=media`);
}
