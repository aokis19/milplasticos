// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4GQv7odzKtxg36f_SSWLbQF-TmYi4xYI",
  authDomain: "system-mil.firebaseapp.com",
  projectId: "system-mil",
  storageBucket: "system-mil.firebasestorage.app",
  messagingSenderId: "138426359863",
  appId: "1:138426359863:web:ab731a7ae1b7e03f7a1fb2",
  measurementId: "G-DYCDBRZSHZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);