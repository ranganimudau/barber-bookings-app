import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth
} from "firebase/auth";
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

// Initialize Auth with persistence correctly
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Fallback if initializeAuth is already called or fails
  auth = getAuth(app);
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export { auth };

