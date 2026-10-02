// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";

// Firebase configuration
 const firebaseConfig = {
    apiKey: "AIzaSyAQ8YPGxHskBKDdTUyy-Zf2bsxRWYebWKU",
    authDomain: "bleev-creations-photography.firebaseapp.com",
    projectId: "bleev-creations-photography",
    storageBucket: "bleev-creations-photography.firebasestorage.app",
    messagingSenderId: "1035315236217",
    appId: "1:1035315236217:web:0cff6f55165f1357c6f3a8",
    measurementId: "G-NJYKW4Y1SK"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
