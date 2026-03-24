import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAyJ5IWswQN23TIewl-b-aEysrPEp7Grs4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gudangarum.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gudangarum",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gudangarum.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "331815565687",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:331815565687:web:c38df77beb3d98af1c8972",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-22YY9G13Q2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
