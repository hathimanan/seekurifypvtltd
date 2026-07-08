// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import env from "dotenv";
env.config();
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "securify-d8e21.firebaseapp.com",
  projectId: "securify-d8e21",
  storageBucket: "securify-d8e21.firebasestorage.app",
  messagingSenderId: "945230002935",
  appId: "1:945230002935:web:86250d8e25a07d2487b1f2",
  measurementId: "G-KK9DPKGGLH"
};
const app = initializeApp(firebaseConfig);
export { app }
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
