// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBoWvtStSddplApt6NieGTD9uBWIyk0Oz0",
  authDomain: "bleev-creations.firebaseapp.com",
  projectId: "bleev-creations",
  storageBucket: "bleev-creations.appspot.com", // ✅ corrected
  messagingSenderId: "1043941419628",
  appId: "1:1043941419628:web:f3743b03d163d33c538649",
  measurementId: "G-8LJ8V9DB45"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
