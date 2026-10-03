// Shared by admin/panel.html and admin/about.html.
// - sends visitors who aren't logged in to /admin/login.html
// - adminFetch(): fetch() that attaches the Firebase ID token the API checks
// - prepareImage(): shrinks big photos so each upload stays under Vercel's 4.5 MB request limit
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

 const firebaseConfig = {
    apiKey: "AIzaSyAQ8YPGxHskBKDdTUyy-Zf2bsxRWYebWKU",
    authDomain: "bleev-creations-photography.firebaseapp.com",
    projectId: "bleev-creations-photography",
    storageBucket: "bleev-creations-photography.firebasestorage.app",
    messagingSenderId: "1035315236217",
    appId: "1:1035315236217:web:0cff6f55165f1357c6f3a8",
    measurementId: "G-NJYKW4Y1SK"
  };

 const app = initializeApp(firebaseConfig);
 
const auth = getAuth(app);

let resolveReady;
window.adminReady = new Promise((resolve) => (resolveReady = resolve));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/admin/login.html");
    return;
  }
  document.documentElement.style.visibility = "visible";
  resolveReady(user);
});

window.adminFetch = async (url, options = {}) => {
  const user = await window.adminReady;
  const token = await user.getIdToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
};

window.adminLogout = async () => {
  await signOut(auth);
   window.location.replace("/homepage.html");
};

window.prepareImage = async (file, maxSize = 2400, limit = 3.5 * 1024 * 1024) => {
  const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (okType && file.size <= limit) return file; // small enough: upload the original untouched

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= limit) return blob;
  }
  throw new Error(`${file.name} is too large to upload`);
};
