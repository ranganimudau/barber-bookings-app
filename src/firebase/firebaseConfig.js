// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCCKhk6bxlIHqODQgqZUBfX0TTMg8z04lE",
  authDomain: "barber-booking-app-d1072.firebaseapp.com",
  projectId: "barber-booking-app-d1072",
  storageBucket: "barber-booking-app-d1072.firebasestorage.app",
  messagingSenderId: "785865796341",
  appId: "1:785865796341:web:e0aaa43796b434484073bc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);