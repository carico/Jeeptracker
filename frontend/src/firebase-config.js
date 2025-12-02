// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUEOpgJIq5_9SxzlPkrZ4_eTwMtUOm57o",
  authDomain: "iwas123jeepney.firebaseapp.com",
  projectId: "iwas123jeepney",
  storageBucket: "iwas123jeepney.firebasestorage.app",
  messagingSenderId: "185467833786",
  appId: "1:185467833786:web:f6956b5b7163c8ce88a183",
  measurementId: "G-TS3YY2S64G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);